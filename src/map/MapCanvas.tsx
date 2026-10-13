import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MLMap, type GeoJSONSource } from "maplibre-gl";
import { CAMERA, COLORS } from "../config";
import { circlePoly, destPoint, prefersReducedMotion } from "../lib";
import { iconForType, registerMapIcons } from "./icons";
import { uaDead, uaGroup, uaIcon } from "../mapaua";
import { LOCAL_META, LOCAL_ORDER, NOTAM_META, visibleLocal } from "../overlays";
import { loadAdmin, loadGminy, powiatLevels as decodePowiaty, wojInView, type AdminLayers } from "../admin";
import { openGmina } from "../place";
import { useStore } from "../store";
import type { FusionState, LocalCategory, VoivodeshipState } from "../types";
import type { Feature, FeatureCollection } from "geojson";

function hatch(color: string) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d")!;
  g.strokeStyle = color;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-2, 10);
  g.lineTo(10, -2);
  g.moveTo(6, 18);
  g.lineTo(18, 6);
  g.stroke();
  return g.getImageData(0, 0, 16, 16);
}

function voivPaint(state: FusionState | null, hist: Record<string, number> | null) {
  const map = new Map<string, VoivodeshipState>();
  if (state) for (const v of state.voivodeships) map.set(v.id, v);
  return (id: string) => {
    if (hist && hist[id] != null) {
      const p = hist[id];
      const paint = p >= 4 ? "priority" : p >= 2 ? "watch" : "info";
      return { paint, points: p };
    }
    const v = map.get(id);
    return { paint: v?.paint ?? "info", points: v?.points ?? 0 };
  };
}

export function MapCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const hasFresh = useRef(false);

  const state = useStore((s) => s.state);
  const hover = useStore((s) => s.hoverVoiv);
  const selected = useStore((s) => s.selectedVoiv);
  const selectedObj = useStore((s) => s.selectedObj);
  const objTrack = useStore((s) => s.objTrack);
  const uaThreats = useStore((s) => s.uaThreats);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [adminTick, setAdminTick] = useState(0);
  const adminRef = useRef<AdminLayers | null>(null);
  /** Gmina features loaded so far, per voivodeship. */
  const gminyRef = useRef(new Map<string, Feature[]>());
  const uaMissilesOn = useStore((s) => s.uaMissilesOn);
  const uaBombsOn = useStore((s) => s.uaBombsOn);
  const uaDronesOn = useStore((s) => s.uaDronesOn);
  const selectedUa = useStore((s) => s.selectedUa);
  const labelDensity = useStore((s) => s.labelDensity);
  const preset = useStore((s) => s.cameraPreset);
  const nonce = useStore((s) => s.cameraNonce);
  const lang = useStore((s) => s.lang);
  const airspace = useStore((s) => s.airspace);
  const notamOn = useStore((s) => s.notamOn);
  const zonesOn = useStore((s) => s.zonesOn);
  const selectedNotams = useStore((s) => s.selectedNotams);
  const localAlerts = useStore((s) => s.localAlerts);
  const localOn = useStore((s) => s.localOn);
  const localCats = useStore((s) => s.localCats);
  const focus = useStore((s) => s.focus);
  const selectedGmina = useStore((s) => s.selectedGmina);
  const searchPin = useStore((s) => s.searchPin);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        bounds: CAMERA.defaultBounds,
        fitBoundsOptions: { padding: CAMERA.padding, pitch: 0, bearing: 0 },
        minZoom: CAMERA.minZoom,
        maxZoom: CAMERA.maxZoom,
        maxBounds: CAMERA.maxBounds,
        attributionControl: false,
        fadeDuration: prefersReducedMotion() ? 0 : 180,
        pitchWithRotate: false,
        dragRotate: false,
        renderWorldCopies: false,
      });
    } catch (err) {
      console.error("Zorya map init", err);
      return;
    }
    mapRef.current = map;
    map.on("error", (e) => console.error("Zorya map", e.error || e));
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new FitAllControl(), "top-right");

    map.on("load", () => {
      // Settings may have been restored from storage (or changed) before the style loaded; the
      // effects that sync them skip while !ready, so the layers below start from the store.
      const initial = useStore.getState();
      registerMapIcons(map);
      if (map.getLayer("place_state")) {
        map.setLayoutProperty("place_state", "visibility", "none");
      }
      map.resize();
      if (!map.hasImage("hatch-amber")) map.addImage("hatch-amber", hatch("rgba(224,161,0,0.85)"));
      if (!map.hasImage("hatch-gray")) map.addImage("hatch-gray", hatch("rgba(154,168,184,0.7)"));

      map.addSource("ua", { type: "geojson", data: "/geo/ua-oblasts.geojson", promoteId: "id" });
      map.addSource("pl", { type: "geojson", data: "/geo/pl-voivodeships.geojson", promoteId: "id" });
      map.addSource("objects", { type: "geojson", data: emptyFc() });
      map.addSource("unc", { type: "geojson", data: emptyFc() });
      map.addSource("tracks", { type: "geojson", data: emptyFc() });
      map.addSource("track-hl", { type: "geojson", data: emptyFc() });
      map.addSource("mua", { type: "geojson", data: emptyFc() });
      map.addSource("mua-lines", { type: "geojson", data: emptyFc() });
      map.addSource("adsb", { type: "geojson", data: emptyFc() });
      map.addSource("zones", { type: "geojson", data: emptyFc() });
      map.addSource("aszones", { type: "geojson", data: emptyFc() });
      map.addSource("notam", { type: "geojson", data: emptyFc() });
      map.addSource("notam-pts", { type: "geojson", data: emptyFc() });
      map.addSource("local", { type: "geojson", data: emptyFc() });
      // Alerts with an exact place or a gmina/powiat (outage points, named gminy), clustered when zoomed out.
      map.addSource("local-pts", { type: "geojson", data: emptyFc(), cluster: true, clusterRadius: 36, clusterMaxZoom: 11 });
      map.addSource("powiaty", { type: "geojson", data: emptyFc(), promoteId: "id" });
      map.addSource("gminy", { type: "geojson", data: emptyFc(), promoteId: "id" });
      map.addSource("search-pin", { type: "geojson", data: emptyFc() });
      map.addSource("cameras", {
        type: "geojson",
        data: emptyFc(),
        cluster: true,
        clusterRadius: 42,
        clusterMaxZoom: 10,
      });

      map.addLayer({
        id: "ua-fill",
        type: "fill",
        source: "ua",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "alert"], false],
            COLORS.uaAlert,
            COLORS.uaRest,
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "alert"], false],
            0.16,
            0.55,
          ],
        },
      });
      map.addLayer({
        id: "ua-line",
        type: "line",
        source: "ua",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "alert"], false],
            COLORS.crimson,
            "#2A1C38",
          ],
          "line-width": ["case", ["boolean", ["feature-state", "alert"], false], 1.8, 0.6],
        },
      });
      map.addLayer({
        id: "ua-label",
        type: "symbol",
        source: "ua",
        minzoom: 6,
        layout: {
          "text-field": ["get", initial.lang === "en" ? "name_en" : "name_pl"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-padding": 8,
        },
        paint: {
          "text-color": "#C9B8D8",
          "text-halo-color": "#070B12",
          "text-halo-width": 1.3,
        },
      });

      map.addLayer({
        id: "pl-fill",
        type: "fill",
        source: "pl",
        paint: {
          // Above POWIAT_ZOOM the powiaty carry the colour — but only once they are painted ("pp"); until then (or if
          // the boundaries or powiat levels never arrive) the voivodeship keeps its level colour.
          "fill-color": ["step", ["zoom"], LEVEL_COLOR, POWIAT_ZOOM, ["case", ["boolean", ["feature-state", "pp"], false], COLORS.navy, LEVEL_COLOR]],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            POWIAT_ZOOM - 0.4,
            [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.72,
              ["match", ["coalesce", ["feature-state", "paint"], "info"], "priority", 0.45, "watch", 0.35, "transfer", 0.2, 0.42],
            ],
            // Powiaty carry the level colour from here (when painted); the voivodeship keeps only the dark base.
            POWIAT_ZOOM,
            [
              "case",
              ["boolean", ["feature-state", "pp"], false],
              ["case", ["boolean", ["feature-state", "hover"], false], 0.5, 0.42],
              [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.72,
                ["match", ["coalesce", ["feature-state", "paint"], "info"], "priority", 0.45, "watch", 0.35, "transfer", 0.2, 0.42],
              ],
            ],
          ],
        },
      });
      // Powiaty: coloured by their own level from POWIAT_ZOOM; below it the voivodeship fill carries the colour.
      map.addLayer({
        id: "pow-fill",
        type: "fill",
        source: "powiaty",
        paint: {
          "fill-color": LEVEL_COLOR,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            POWIAT_ZOOM - 0.4,
            0,
            POWIAT_ZOOM,
            ["match", ["coalesce", ["feature-state", "paint"], "info"], "priority", 0.45, "watch", 0.35, "transfer", 0.2, 0],
          ],
        },
      });
      map.addLayer({
        id: "pow-line",
        type: "line",
        source: "powiaty",
        minzoom: POWIAT_ZOOM - 0.5,
        paint: {
          "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#E8EEF7", "#4A5A70"],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5.5,
            ["case", ["boolean", ["feature-state", "selected"], false], 1.8, 0.4],
            8,
            ["case", ["boolean", ["feature-state", "selected"], false], 2.2, 1],
          ],
          "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.9, 0.7],
        },
      });
      // Gminy: outlines and a (nearly) invisible fill for taps, from GMINA_ZOOM; the chosen one is highlighted.
      map.addLayer({
        id: "gminy-fill",
        type: "fill",
        source: "gminy",
        minzoom: GMINA_ZOOM - 0.3,
        paint: {
          "fill-color": "#E8EEF7",
          "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.16, 0.01],
        },
      });
      map.addLayer({
        id: "gminy-line",
        type: "line",
        source: "gminy",
        minzoom: GMINA_ZOOM - 0.3,
        paint: {
          "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#FFFFFF", "#8796AB"],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            ["case", ["boolean", ["feature-state", "selected"], false], 2.6, 0.3],
            10,
            ["case", ["boolean", ["feature-state", "selected"], false], 3, 0.9],
          ],
          "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, 0.55],
        },
      });
      map.addLayer({
        id: "pl-line",
        type: "line",
        source: "pl",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#FFFFFF",
            [
              "match",
              ["coalesce", ["feature-state", "paint"], "info"],
              "priority",
              COLORS.crimson,
              "watch",
              COLORS.amber,
              "transfer",
              COLORS.olive,
              COLORS.border,
            ],
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2.2,
            ["match", ["coalesce", ["feature-state", "paint"], "info"], "priority", 2.2, "watch", 2, 1],
          ],
        },
      });
      map.addLayer({
        id: "pl-label",
        type: "symbol",
        source: "pl",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": labelSize(initial.labelDensity),
          "text-padding": 4,
        },
        paint: {
          "text-color": COLORS.text,
          "text-halo-color": "#070B12",
          "text-halo-width": 1.4,
        },
      });

      map.addLayer({
        id: "zones-fill",
        type: "fill",
        source: "zones",
        layout: { visibility: "none" },
        paint: {
          "fill-color": ["match", ["get", "kind"], "score", "#E0A100", "#9AA8B8"],
          "fill-opacity": 0.22,
        },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: "zones",
        layout: { visibility: "none" },
        paint: {
          "line-color": ["match", ["get", "kind"], "score", COLORS.amber, "#9AA8B8"],
          "line-width": 1.2,
        },
      });

      // Permanent P/R/D/TSA/TRA areas (OpenAIP): faint, dashed — they exist, they are not necessarily active.
      map.addLayer({
        id: "asz-fill",
        type: "fill",
        source: "aszones",
        layout: { visibility: initial.zonesOn ? "visible" : "none" },
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.05 },
      });
      map.addLayer({
        id: "asz-line",
        type: "line",
        source: "aszones",
        layout: { visibility: initial.zonesOn ? "visible" : "none" },
        paint: { "line-color": ["get", "color"], "line-width": 1, "line-opacity": 0.7, "line-dasharray": [4, 2] },
      });
      map.addLayer({
        id: "asz-label",
        type: "symbol",
        source: "aszones",
        minzoom: 7,
        layout: {
          visibility: initial.zonesOn ? "visible" : "none",
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-padding": 6,
        },
        paint: { "text-color": ["get", "color"], "text-halo-color": "#070B12", "text-halo-width": 1.3 },
      });
      // NOTAM areas: active ones filled and outlined solid; upcoming ones and Q-line circles
      // (approximate, the NOTAM did not spell the area out) outlined dashed.
      map.addLayer({
        id: "notam-fill",
        type: "fill",
        source: "notam",
        layout: { visibility: initial.notamOn ? "visible" : "none" },
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["case", ["get", "sel"], 0.32, ["get", "active"], 0.18, 0.05],
        },
      });
      map.addLayer({
        id: "notam-line",
        type: "line",
        source: "notam",
        filter: ["!", ["get", "dash"]],
        layout: { visibility: initial.notamOn ? "visible" : "none", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": ["case", ["get", "sel"], 3.2, 2], "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "notam-line-dash",
        type: "line",
        source: "notam",
        filter: ["get", "dash"],
        layout: { visibility: initial.notamOn ? "visible" : "none", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["case", ["get", "sel"], 3, 1.5],
          "line-opacity": ["case", ["get", "active"], 0.9, 0.6],
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "notam-label",
        type: "symbol",
        source: "notam-pts",
        minzoom: 5.6,
        layout: {
          visibility: initial.notamOn ? "visible" : "none",
          "text-field": ["step", ["zoom"], ["get", "id"], 7, ["get", "label"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10.5,
          "text-padding": 4,
          "text-max-width": 12,
        },
        paint: { "text-color": ["get", "color"], "text-halo-color": "#070B12", "text-halo-width": 1.5 },
      });

      map.addLayer({
        id: "unc-line",
        type: "line",
        source: "unc",
        paint: {
          "line-color": "#E8EEF7",
          "line-opacity": 0.45,
          "line-width": 1,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "track-line",
        type: "line",
        source: "tracks",
        paint: {
          "line-color": "#E0A100",
          "line-opacity": 0.7,
          "line-width": 1.4,
          "line-dasharray": [3, 3],
        },
      });
      // Archived route of the drone opened in the panel (180-day archive), drawn above the live trails.
      map.addLayer({
        id: "track-hl-casing",
        type: "line",
        source: "track-hl",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#070B12", "line-opacity": 0.8, "line-width": 6 },
      });
      map.addLayer({
        id: "track-hl-line",
        type: "line",
        source: "track-hl",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.amber, "line-opacity": 0.95, "line-width": 3 },
      });
      map.addLayer({
        id: "track-hl-ends",
        type: "circle",
        source: "track-hl",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4,
          "circle-color": ["case", ["==", ["get", "end"], "first"], "#E8EEF7", COLORS.amber],
          "circle-stroke-color": "#070B12",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "obj-pulse",
        type: "circle",
        source: "objects",
        filter: ["==", ["get", "fresh"], true],
        paint: {
          "circle-radius": 16,
          "circle-color": COLORS.amber,
          "circle-opacity": 0.18,
          "circle-stroke-width": 0,
        },
      });
      map.addLayer({
        id: "obj-icon",
        type: "symbol",
        source: "objects",
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": 0.7,
          "icon-allow-overlap": true,
          "icon-rotate": ["get", "course"],
          "icon-rotation-alignment": "map",
          "text-field": ["step", ["zoom"], "", 7.2, ["get", "label"]],
          "text-font": ["Noto Sans Regular"],
          "text-offset": [0, 1.4],
          "text-size": 11,
          "text-optional": true,
        },
        paint: {
          "text-color": COLORS.text,
          "text-halo-color": "#070B12",
          "text-halo-width": 1.3,
        },
      });
      // MAPA.UA (missiles / KAB / drones over Ukraine): trail, dashed line to the predicted position, icon.
      map.addLayer({
        id: "mua-trail",
        type: "line",
        source: "mua-lines",
        filter: ["==", ["get", "role"], "trail"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["case", ["get", "dead"], "#6B7480", ["get", "color"]],
          "line-opacity": ["case", ["get", "sel"], 1, ["get", "dead"], 0.45, 0.8],
          "line-width": ["case", ["get", "sel"], 3.2, 1.6],
        },
      });
      map.addLayer({
        id: "mua-pred",
        type: "line",
        source: "mua-lines",
        filter: ["==", ["get", "role"], "pred"],
        paint: {
          "line-color": ["get", "color"],
          "line-opacity": 0.9,
          "line-width": ["case", ["get", "sel"], 2.4, 1.4],
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "mua-icon",
        type: "symbol",
        source: "mua",
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": ["case", ["get", "sel"], 0.95, 0.75],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "symbol-sort-key": ["case", ["get", "dead"], 0, 1],
        },
        paint: { "icon-opacity": ["case", ["get", "dead"], 0.6, 1] },
      });
      map.addLayer({
        id: "adsb-civ",
        type: "symbol",
        source: "adsb",
        filter: ["==", ["get", "kind"], "civ"],
        layout: {
          "icon-image": "adsb-civ",
          "icon-size": 0.46,
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": false,
          // Informational traffic must not win label collisions and hide voivodeship names.
          "icon-ignore-placement": true,
          "text-field": ["step", ["zoom"], "", 8.2, ["get", "label"]],
          "text-font": ["Noto Sans Regular"],
          "text-offset": [0, 1.25],
          "text-size": 10,
          "text-optional": true,
        },
        paint: {
          "text-color": "#9AA8B8",
          "text-halo-color": "#070B12",
          "text-halo-width": 1.1,
        },
      });
      map.addLayer({
        id: "adsb-mil",
        type: "symbol",
        source: "adsb",
        filter: ["==", ["get", "kind"], "mil"],
        layout: {
          "icon-image": "adsb-mil",
          "icon-size": 0.65,
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "text-field": ["step", ["zoom"], "", 6.5, ["get", "label"]],
          "text-font": ["Noto Sans Regular"],
          "text-offset": [0, 1.3],
          "text-size": 11,
        },
        paint: {
          "text-color": COLORS.cyan,
          "text-halo-color": "#070B12",
          "text-halo-width": 1.2,
        },
      });
      map.addLayer({
        id: "cam-clusters",
        type: "circle",
        source: "cameras",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1C2A3F",
          "circle-stroke-color": "#9AA8B8",
          "circle-stroke-width": 1,
          "circle-radius": 14,
        },
      });
      map.addLayer({
        id: "cam-count",
        type: "symbol",
        source: "cameras",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          // Camera pins sit on the eastern border and would otherwise hide "lubelskie"/"podkarpackie".
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": COLORS.text },
      });
      map.addLayer({
        id: "cam-icon",
        type: "symbol",
        source: "cameras",
        filter: ["!", ["has", "point_count"]],
        layout: { "icon-image": "cam-pin", "icon-size": 0.9, "icon-allow-overlap": true, "icon-ignore-placement": true },
      });
      // Local alerts: a row of badges under each voivodeship's centre, one per category.
      map.addLayer({
        id: "local-icon",
        type: "symbol",
        source: "local",
        maxzoom: GMINA_ZOOM,
        filter: ["==", ["get", "set"], "all"],
        layout: {
          visibility: initial.localOn ? "visible" : "none",
          "icon-image": ["get", "icon"],
          "icon-size": LOCAL_ICON_SIZE,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-offset": slotMatch((k, i) => [localDx(k, i) / LOCAL_ICON_SIZE, LOCAL_DY / LOCAL_ICON_SIZE]),
          "text-field": ["case", [">", ["get", "n"], 1], ["to-string", ["get", "n"]], ""],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-offset": slotMatch((k, i) => [(localDx(k, i) + 10) / 10, (LOCAL_DY - 9) / 10]),
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-optional": true,
        },
        paint: {
          "icon-opacity": ["case", ["get", "active"], 1, 0.6],
          "text-color": "#E8EEF7",
          "text-halo-color": "#070B12",
          "text-halo-width": 1.6,
        },
      });
      map.addLayer({
        id: "pow-label",
        type: "symbol",
        source: "powiaty",
        minzoom: 7,
        maxzoom: 9,
        layout: { "text-field": ["get", "short"], "text-font": ["Noto Sans Regular"], "text-size": 10.5, "text-padding": 6 },
        paint: { "text-color": "#C2CCDA", "text-halo-color": "#070B12", "text-halo-width": 1.3 },
      });
      map.addLayer({
        id: "gminy-label",
        type: "symbol",
        source: "gminy",
        minzoom: 9,
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-padding": 4 },
        paint: { "text-color": "#E8EEF7", "text-halo-color": "#070B12", "text-halo-width": 1.4 },
      });
      // Precise local alerts (zoomed in): clusters with a count, single alerts with their category icon.
      map.addLayer({
        id: "local-pt-cluster",
        type: "circle",
        source: "local-pts",
        minzoom: GMINA_ZOOM,
        filter: ["has", "point_count"],
        layout: { visibility: initial.localOn ? "visible" : "none" },
        paint: {
          "circle-color": "#1C2A3F",
          "circle-stroke-color": "#F2C14E",
          "circle-stroke-width": 1.5,
          "circle-radius": ["step", ["get", "point_count"], 11, 10, 14, 50, 18],
        },
      });
      map.addLayer({
        id: "local-pt-count",
        type: "symbol",
        source: "local-pts",
        minzoom: GMINA_ZOOM,
        filter: ["has", "point_count"],
        layout: {
          visibility: initial.localOn ? "visible" : "none",
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#E8EEF7" },
      });
      map.addLayer({
        id: "local-pt-icon",
        type: "symbol",
        source: "local-pts",
        minzoom: GMINA_ZOOM,
        filter: ["!", ["has", "point_count"]],
        layout: {
          visibility: initial.localOn ? "visible" : "none",
          "icon-image": ["get", "icon"],
          "icon-size": LOCAL_ICON_SIZE,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-opacity": ["case", ["get", "active"], 1, 0.6] },
      });
      map.addLayer({
        id: "local-icon-wide",
        type: "symbol",
        source: "local",
        minzoom: GMINA_ZOOM,
        filter: ["==", ["get", "set"], "wide"],
        layout: {
          visibility: initial.localOn ? "visible" : "none",
          "icon-image": ["get", "icon"],
          "icon-size": LOCAL_ICON_SIZE,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-offset": slotMatch((k, i) => [localDx(k, i) / LOCAL_ICON_SIZE, LOCAL_DY / LOCAL_ICON_SIZE]),
          "text-field": ["case", [">", ["get", "n"], 1], ["to-string", ["get", "n"]], ""],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-offset": slotMatch((k, i) => [(localDx(k, i) + 10) / 10, (LOCAL_DY - 9) / 10]),
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-optional": true,
        },
        paint: {
          "icon-opacity": ["case", ["get", "active"], 1, 0.6],
          "text-color": "#E8EEF7",
          "text-halo-color": "#070B12",
          "text-halo-width": 1.6,
        },
      });
      // Found address / "my location".
      map.addLayer({
        id: "search-pin",
        type: "circle",
        source: "search-pin",
        paint: {
          "circle-radius": 7,
          "circle-color": "#FFFFFF",
          "circle-stroke-color": "#070B12",
          "circle-stroke-width": 3,
        },
      });
      // Region names on top: markers and clusters must not cover them.
      map.moveLayer("pl-label");

      map.on("mousemove", "pl-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const id = String(e.features?.[0]?.id ?? "");
        const store = useStore.getState();
        if (store.hoverVoiv !== id) store.setHoverVoiv(id);
      });
      map.on("mouseleave", "pl-fill", () => {
        map.getCanvas().style.cursor = "";
        useStore.getState().setHoverVoiv(null);
      });
      // Drone markers win over the region underneath; a tap on empty map closes the panel.
      const OBJ_LAYERS = ["mua-icon", "obj-icon", "obj-pulse"];
      const objAt = (pt: maplibregl.PointLike) => {
        const layers = OBJ_LAYERS.filter((l) => map.getLayer(l));
        if (!layers.length) return null;
        // A small box makes the tiny icons easier to hit with a finger.
        const p = pt as { x: number; y: number };
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [
          [p.x - 10, p.y - 10],
          [p.x + 10, p.y + 10],
        ];
        const fs = map.queryRenderedFeatures(box, { layers });
        // MAPA.UA missiles first (they are the rarer, more urgent marker), then NEPTUN objects.
        const f = fs.find((x) => x.layer.id === "mua-icon") ?? fs[0];
        if (!f) return null;
        const id = String(f.properties?.id ?? f.id ?? "");
        return f.layer.id === "mua-icon" ? `ua:${id}` : id;
      };
      for (const l of [...OBJ_LAYERS, "local-icon", "local-icon-wide", "local-pt-icon", "local-pt-cluster"]) {
        map.on("mouseenter", l, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", l, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      map.on("click", (e) => {
        const store = useStore.getState();
        const obj = objAt(e.point);
        if (obj) {
          if (obj.startsWith("ua:")) store.setSelectedUa(obj.slice(3));
          else store.setSelectedObj(obj);
          return;
        }
        const p = e.point;
        const near: [maplibregl.PointLike, maplibregl.PointLike] = [
          [p.x - 8, p.y - 8],
          [p.x + 8, p.y + 8],
        ];
        const zoomedIn = map.getZoom() >= GMINA_ZOOM;
        // Cluster of precise local alerts: zoom in until it splits.
        const cluster = zoomedIn ? map.queryRenderedFeatures(near, { layers: ["local-pt-cluster"] })[0] : null;
        if (cluster) {
          const src = map.getSource("local-pts") as GeoJSONSource;
          const geom = cluster.geometry as { type: "Point"; coordinates: [number, number] };
          void src.getClusterExpansionZoom(cluster.properties?.cluster_id).then((z) => map.easeTo({ center: geom.coordinates, zoom: z }));
          return;
        }
        // A precise alert opens the gmina it sits in (the gmina panel lists it with the others there).
        const pin = zoomedIn ? map.queryRenderedFeatures(near, { layers: ["local-pt-icon"] })[0] : null;
        if (pin) {
          const [lon, lat] = (pin.geometry as { type: "Point"; coordinates: [number, number] }).coordinates;
          void openGmina({ lat, lon });
          return;
        }
        // A local-alert badge opens its voivodeship (the panel lists the alerts).
        const badge = map.queryRenderedFeatures(near, { layers: ["local-icon", "local-icon-wide"].filter((l) => map.getLayer(l)) })[0];
        if (badge?.properties?.voiv) {
          store.setSelectedVoiv(String(badge.properties.voiv));
          return;
        }
        // Zoomed in, a tap means "this gmina": its panel lists the zones, alerts and threats that concern it.
        if (zoomedIn) {
          const g = map.queryRenderedFeatures(e.point, { layers: ["gminy-fill"] })[0];
          const code = g ? String(g.properties?.id ?? g.id ?? "") : "";
          // Airspace areas under the finger stay reachable from the gmina panel.
          const under = map.queryRenderedFeatures(e.point, { layers: ["notam-fill", "asz-fill"].filter((l) => map.getLayer(l)) });
          const keys = [...new Set(under.map((f) => String(f.properties?.key ?? "")).filter(Boolean))];
          void openGmina(code ? { gmina: code } : { lat: e.lngLat.lat, lon: e.lngLat.lng }).then((ok) => {
            if (ok === false) {
              if (keys.length) useStore.getState().setSelectedNotams(keys);
              else useStore.getState().setSelectedVoiv(null); // outside Poland
            } else if (keys.length) useStore.setState({ tapAreas: keys });
          });
          return;
        }
        // Inside NOTAM / permanent areas: list every area under the finger.
        const areaLayers = ["notam-fill", "asz-fill"].filter((l) => map.getLayer(l));
        const areas = areaLayers.length ? map.queryRenderedFeatures(e.point, { layers: areaLayers }) : [];
        if (areas.length) {
          const ids = [...new Set(areas.map((f) => String(f.properties?.key ?? "")).filter(Boolean))];
          if (ids.length) {
            store.setSelectedNotams(ids);
            return;
          }
        }
        const reg = map.getLayer("pl-fill") ? map.queryRenderedFeatures(e.point, { layers: ["pl-fill"] })[0] : null;
        if (reg) {
          store.setSelectedVoiv(String(reg.id ?? ""));
          return;
        }
        if (store.selectedVoiv || store.selectedObj || store.selectedUa || store.selectedNotams || store.selectedGmina) {
          store.setSelectedVoiv(null);
        }
      });
      map.on("click", "cam-clusters", (e) => {
        const f = e.features?.[0];
        const src = map.getSource("cameras") as GeoJSONSource;
        if (!f || !src.getClusterExpansionZoom) return;
        src.getClusterExpansionZoom(f.properties?.cluster_id).then((z) => {
          const geom = f.geometry as { type: "Point"; coordinates: [number, number] };
          map.easeTo({ center: geom.coordinates, zoom: z });
        });
      });

      ready.current = true;
      setMapReadyTick((t) => t + 1);
      applyData(map);

      const fetchAdmin = () => loadAdmin()
        .then((layers) => {
          adminRef.current = layers;
          const fc = {
            ...layers.powiaty,
            features: layers.powiaty.features.map((f) => ({
              ...f,
              properties: { ...f.properties, short: f.properties.city ? f.properties.name : `pow. ${f.properties.name}` },
            })),
          };
          (map.getSource("powiaty") as GeoJSONSource | undefined)?.setData(fc);
          // Same topology as the powiaty, so voivodeship and powiat borders coincide exactly.
          (map.getSource("pl") as GeoJSONSource | undefined)?.setData(layers.woj);
          setAdminTick((t) => t + 1);
          void syncGminy(map);
        })
        .catch((err) => console.error("Zorya powiaty", err));
      void fetchAdmin();
      // A failed boundary load is retried on the next map move, not given up for the session.
      map.on("moveend", () => {
        if (!adminRef.current) void fetchAdmin();
        void syncGminy(map);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Loads the gmina files the viewport needs (zoomed in only) and the selected gmina's voivodeship. */
  async function syncGminy(map: MLMap) {
    const layers = adminRef.current;
    if (!layers) return;
    const want = new Set<string>();
    if (map.getZoom() >= GMINA_ZOOM - 0.5) {
      const b = map.getBounds();
      for (const id of wojInView(layers, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])) want.add(id);
    }
    const sel = useStore.getState().selectedGmina;
    if (sel) want.add(sel.voivodeship);
    const missing = [...want].filter((id) => !gminyRef.current.has(id));
    if (!missing.length) return;
    const got = await Promise.all(missing.map((id) => loadGminy(id).then((fc) => [id, fc.features] as const).catch(() => null)));
    let added = false;
    for (const g of got) {
      if (!g || gminyRef.current.has(g[0])) continue;
      gminyRef.current.set(g[0], g[1] as Feature[]);
      added = true;
    }
    if (!added) return;
    (map.getSource("gminy") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: [...gminyRef.current.values()].flat() });
    applyGminaSelection(map);
  }

  /** Highlights the selected gmina and its powiat (feature-state, no data reload). */
  const selectedRef = useRef<{ g: string | null; p: string | null }>({ g: null, p: null });
  function applyGminaSelection(map: MLMap) {
    const sel = useStore.getState().selectedGmina;
    const prev = selectedRef.current;
    const next = { g: sel?.gmina.id ?? null, p: sel?.gmina.powiat.id ?? null };
    if (!map.getSource("gminy") || !map.getSource("powiaty")) return;
    if (prev.g && prev.g !== next.g) map.setFeatureState({ source: "gminy", id: prev.g }, { selected: false });
    if (prev.p && prev.p !== next.p) map.setFeatureState({ source: "powiaty", id: prev.p }, { selected: false });
    if (next.g) map.setFeatureState({ source: "gminy", id: next.g }, { selected: true });
    if (next.p) map.setFeatureState({ source: "powiaty", id: next.p }, { selected: true });
    selectedRef.current = next;
  }

  /** Hover and selection only — cheap enough to run on every pointer move between regions. */
  function applyFocus(map: MLMap) {
    const { state: st, selectedVoiv, hoverVoiv } = useStore.getState();
    if (!st || !map.getSource("pl")) return;
    for (const v of st.voivodeships) {
      map.setFeatureState({ source: "pl", id: v.id }, { selected: selectedVoiv === v.id, hover: hoverVoiv === v.id });
    }
  }

  // Everything is read from the store, not from render props: the "load" handler keeps the
  // first render's closure, so props would be stale there.
  function applyData(map: MLMap) {
    const st = useStore.getState().state;
    const histMode = false;
    const neptunOn = true;
    const uaOn = true;
    const civOn = true;
    const milOn = true;
    const tracksOn = true;
    const histPts = null;
    const lookup = voivPaint(st, histPts);

    const pl = map.getSource("pl") as GeoJSONSource | undefined;
    if (pl && st) {
      for (const v of st.voivodeships) {
        map.setFeatureState({ source: "pl", id: v.id }, { paint: lookup(v.id).paint });
      }
      applyFocus(map);
    }
    if (st) {
      for (const a of st.ua_alerts) {
        map.setFeatureState({ source: "ua", id: a.oblast }, { alert: uaOn && a.active });
      }
    }

    const objects = histMode || !neptunOn ? [] : st?.objects ?? [];
    const objFc: FeatureCollection = {
      type: "FeatureCollection",
      features: objects.map((o) => {
        const age = (Date.now() - new Date(o.ts).getTime()) / 60000;
        const label = `${iconLabel(o.type)} · ${(o.confidence * 100).toFixed(0)}% · ±${o.unc_km} km · ${Math.max(0, Math.round(age))} min`;
        return {
          type: "Feature",
          id: o.id,
          properties: {
            id: o.id,
            icon: iconForType(o.type),
            course: o.course ?? 0,
            fresh: age < 10,
            label,
            observation: o.observation,
          },
          geometry: { type: "Point", coordinates: [o.lon, o.lat] },
        };
      }),
    };
    (map.getSource("objects") as GeoJSONSource | undefined)?.setData(objFc);
    hasFresh.current = objFc.features.some((f) => f.properties?.fresh);

    const uncFc: FeatureCollection = {
      type: "FeatureCollection",
      features: objects.map((o) => ({
        type: "Feature" as const,
        properties: { id: o.id },
        geometry: { type: "Polygon" as const, coordinates: circlePoly(o.lon, o.lat, o.unc_km) },
      })),
    };
    (map.getSource("unc") as GeoJSONSource | undefined)?.setData(uncFc);

    const trFc: FeatureCollection = {
      type: "FeatureCollection",
      features: tracksOn
        ? objects.flatMap((o) => {
            const trail = (o.trail ?? []).map((p) => [p.lon, p.lat] as [number, number]);
            const line =
              trail.length >= 2
                ? trail
                : o.course != null && o.speed
                  ? ([[o.lon, o.lat], destPoint(o.lon, o.lat, 28, o.course ?? 0)] as [number, number][])
                  : [];
            if (line.length < 2) return [];
            return [
              {
                type: "Feature" as const,
                properties: { id: o.id },
                geometry: { type: "LineString" as const, coordinates: line },
              },
            ];
          })
        : [],
    };
    (map.getSource("tracks") as GeoJSONSource | undefined)?.setData(trFc);

    const adsbFc: FeatureCollection = {
      type: "FeatureCollection",
      features: (histMode ? [] : st?.adsb ?? [])
        .filter((a) => (a.mil ? milOn : civOn))
        .map((a) => ({
        type: "Feature" as const,
        properties: {
          id: a.id,
          heading: a.heading,
          kind: a.mil ? "mil" : "civ",
          label: a.type ? `${a.callsign} · ${a.type}` : a.callsign,
        },
        geometry: { type: "Point" as const, coordinates: [a.lon, a.lat] },
      })),
    };
    (map.getSource("adsb") as GeoJSONSource | undefined)?.setData(adsbFc);

    const zFc: FeatureCollection = {
      type: "FeatureCollection",
      features: (st?.zones ?? []).map((z) => ({
        type: "Feature" as const,
        properties: { id: z.id, kind: z.scores ? "score" : "info" },
        geometry: z.geometry,
      })),
    };
    (map.getSource("zones") as GeoJSONSource | undefined)?.setData(zFc);

    (map.getSource("cameras") as GeoJSONSource | undefined)?.setData(emptyFc());
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    applyData(map);
  }, [state]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    applyFocus(map);
  }, [hover, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const on = { missile: uaMissilesOn, bomb: uaBombsOn, drone: uaDronesOn };
    const list = (uaThreats?.objects ?? []).filter((o) => on[uaGroup(o.kind)]);
    const color = (kind: string) =>
      kind === "missile_ballistic" ? "#B3122A" : kind.startsWith("missile") ? "#FF3B30" : kind === "bomb" ? "#F0783A" : "#F2B544";
    const pts: FeatureCollection = {
      type: "FeatureCollection",
      features: list.map((o) => ({
        type: "Feature" as const,
        id: o.id,
        properties: {
          id: o.id,
          icon: uaIcon(o),
          heading: o.heading ?? 0,
          dead: uaDead(o),
          sel: o.id === selectedUa,
        },
        geometry: { type: "Point" as const, coordinates: [o.lon, o.lat] },
      })),
    };
    const lines: FeatureCollection = {
      type: "FeatureCollection",
      features: list.flatMap((o) => {
        const dead = uaDead(o);
        const base = { id: o.id, dead, sel: o.id === selectedUa, color: color(o.kind) };
        const out: FeatureCollection["features"] = [];
        const tr = [...o.trail];
        const last = tr[tr.length - 1];
        if (!last || last[0] !== o.lon || last[1] !== o.lat) tr.push([o.lon, o.lat]);
        if (tr.length >= 2)
          out.push({ type: "Feature", properties: { ...base, role: "trail" }, geometry: { type: "LineString", coordinates: tr } });
        if (o.predicted && !dead)
          out.push({
            type: "Feature",
            properties: { ...base, role: "pred" },
            geometry: { type: "LineString", coordinates: [[o.lon, o.lat], o.predicted] },
          });
        return out;
      }),
    };
    (map.getSource("mua") as GeoJSONSource | undefined)?.setData(pts);
    (map.getSource("mua-lines") as GeoJSONSource | undefined)?.setData(lines);
  }, [uaThreats, uaMissilesOn, uaBombsOn, uaDronesOn, selectedUa, mapReadyTick]);

  // Selected gmina: make sure its voivodeship's gminy are loaded, then highlight it and its powiat.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    applyGminaSelection(map);
    void syncGminy(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGmina, mapReadyTick, adminTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("search-pin") as GeoJSONSource | undefined)?.setData(
      searchPin ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: searchPin } }] } : emptyFc()
    );
  }, [searchPin, mapReadyTick]);

  // Powiat levels: only powiaty with something to show are sent; everything else is "info".
  const paintedPow = useRef(new Set<string>());
  const powiatLevels = state?.powiaty;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current || !adminRef.current || !map.getSource("powiaty")) return;
    const now = new Set<string>();
    for (const p of decodePowiaty(state).values()) {
      map.setFeatureState({ source: "powiaty", id: p.id }, { paint: p.level });
      now.add(p.id);
    }
    for (const id of paintedPow.current) if (!now.has(id)) map.setFeatureState({ source: "powiaty", id }, { paint: "info" });
    paintedPow.current = now;
    // Voivodeships hand the colour over to the powiaty only when this state carries powiat levels.
    const painted = !!state?.powiaty;
    for (const v of state?.voivodeships ?? []) map.setFeatureState({ source: "pl", id: v.id }, { pp: painted });
  }, [powiatLevels, mapReadyTick, adminTick]);

  // NOTAM areas + permanent areas.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    for (const l of ["notam-fill", "notam-line", "notam-line-dash", "notam-label"]) {
      if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis(notamOn));
    }
    for (const l of ["asz-fill", "asz-line", "asz-label"]) {
      if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis(zonesOn));
    }
    const sel = new Set(selectedNotams ?? []);
    const notams = (airspace?.notam.items ?? []).filter((n) => n.map && n.geometry);
    const areas: Feature[] = notams.map((n) => {
      const key = `notam:${n.location}:${n.id}`;
      const active = n.state === "active";
      return {
        type: "Feature",
        properties: {
          key,
          color: NOTAM_META[n.category]?.color ?? "#9AA8B8",
          active,
          dash: !active || n.geometry_source === "qline",
          sel: sel.has(key),
        },
        geometry: n.geometry!,
      };
    });
    const pts: Feature[] = notams.flatMap((n) => {
      const c = n.bbox ? [(n.bbox[0] + n.bbox[2]) / 2, (n.bbox[1] + n.bbox[3]) / 2] : n.center;
      if (!c) return [];
      const meta = NOTAM_META[n.category];
      const lim = n.lower || n.upper ? ` · ${n.lower ?? "?"}–${n.upper ?? "?"}` : "";
      return [
        {
          type: "Feature",
          properties: { id: n.id, label: `${n.id} · ${meta?.label ?? n.label}${lim}`, color: meta?.color ?? "#9AA8B8" },
          geometry: { type: "Point", coordinates: c },
        },
      ];
    });
    const zones: Feature[] = (airspace?.zones.enabled ? airspace.zones.items : []).map((z) => ({
      type: "Feature",
      properties: {
        key: `zone:${z.id}`,
        color: z.kind === "prohibited" || z.kind === "restricted" ? "#FF5A4E" : z.kind === "danger" ? "#F0783A" : "#E0A100",
        label: `${z.name}${z.lower || z.upper ? ` · ${z.lower ?? "?"}–${z.upper ?? "?"}` : ""}`,
      },
      geometry: z.geometry,
    }));
    (map.getSource("notam") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: areas });
    (map.getSource("notam-pts") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: pts });
    (map.getSource("aszones") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: zones });
  }, [airspace, notamOn, zonesOn, selectedNotams, mapReadyTick]);

  // Local alerts: zoomed out, one badge per category and voivodeship (all alerts); zoomed in, every alert with a
  // place of its own (outage point, named gmina/powiat) as a pin, and badges only for voivodeship-wide ones.
  const voivCentres = state?.voivodeships;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    for (const l of ["local-icon", "local-icon-wide", "local-pt-cluster", "local-pt-count", "local-pt-icon"]) {
      if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", localOn ? "visible" : "none");
    }
    const centre = new Map<string, [number, number]>();
    for (const v of voivCentres ?? []) if (Number.isFinite(v.lon) && Number.isFinite(v.lat)) centre.set(v.id, [v.lon, v.lat]);
    for (const [id, b] of Object.entries(VOIV_BOUNDS)) {
      if (!centre.has(id)) centre.set(id, [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]);
    }
    type Group = Map<string, Map<LocalCategory, { n: number; active: boolean }>>;
    const all: Group = new Map();
    const wide: Group = new Map();
    const add = (groups: Group, voiv: string, c: LocalCategory, active: boolean) => {
      const g = groups.get(voiv) ?? new Map();
      const cur = g.get(c) ?? { n: 0, active: false };
      g.set(c, { n: cur.n + 1, active: cur.active || active });
      groups.set(voiv, g);
    };
    const pins: Feature[] = [];
    for (const a of visibleLocal(localAlerts, localCats)) {
      const cats = a.categories.filter((c) => localCats[c]);
      const active = a.state === "active";
      for (const v of a.voivodeships) for (const c of cats) add(all, v, c, active);
      if (a.at && cats.length) {
        pins.push({
          type: "Feature",
          properties: { id: a.id, icon: LOCAL_META[cats[0]].icon, active },
          geometry: { type: "Point", coordinates: a.at },
        });
      } else for (const v of a.voivodeships) for (const c of cats) add(wide, v, c, active);
    }
    const features: Feature[] = [];
    const badges = (groups: Group, set: string) => {
      for (const [voiv, g] of groups) {
        const at = centre.get(voiv);
        if (!at) continue;
        const cats = LOCAL_ORDER.filter((c) => g.has(c));
        cats.forEach((c, i) => {
          const x = g.get(c)!;
          features.push({
            type: "Feature",
            properties: { voiv, set, icon: LOCAL_META[c].icon, n: x.n, active: x.active, slot: cats.length * 10 + i },
            geometry: { type: "Point", coordinates: at },
          });
        });
      }
    };
    badges(all, "all");
    badges(wide, "wide");
    (map.getSource("local") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
    (map.getSource("local-pts") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: pins });
  }, [localAlerts, localOn, localCats, voivCentres, mapReadyTick]);

  // "Show on map" from the panels: frame the area, leaving room for the bottom sheet on phones.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const [w, s, e, n] = focus.bbox;
    const phone = window.innerWidth <= 640;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      {
        padding: phone
          ? { top: 70, left: 24, right: 24, bottom: Math.round(window.innerHeight * 0.6) }
          : { top: 70, left: 420, right: 60, bottom: 40 },
        maxZoom: 10,
        duration: prefersReducedMotion() ? 0 : 700,
      }
    );
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const src = map.getSource("track-hl") as GeoJSONSource | undefined;
    if (!src) return;
    const line = selectedObj && objTrack && objTrack.length >= 2 ? objTrack : null;
    src.setData(
      line
        ? {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } },
              { type: "Feature", properties: { end: "first" }, geometry: { type: "Point", coordinates: line[0] } },
              { type: "Feature", properties: { end: "last" }, geometry: { type: "Point", coordinates: line[line.length - 1] } },
            ],
          }
        : emptyFc()
    );
  }, [selectedObj, objTrack]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    if (map.getLayer("pl-label")) map.setLayoutProperty("pl-label", "text-size", labelSize(labelDensity));
  }, [labelDensity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    if (map.getLayer("ua-label")) {
      map.setLayoutProperty("ua-label", "text-field", ["get", lang === "en" ? "name_en" : "name_pl"]);
    }
  }, [lang]);

  // Only an explicit camera request moves the camera (preset button, "reset frame", onboarding).
  // Selecting a region or toggling 3D must not throw the user back to the preset's frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { homeVoiv: home, selectedVoiv: sel } = useStore.getState();
    const opt = { padding: CAMERA.padding, duration: prefersReducedMotion() ? 0 : 700, pitch: 0 };
    if (preset === "all") map.fitBounds(CAMERA.all, { ...opt, padding: CAMERA.allPadding });
    else if (preset === "pl") map.fitBounds(CAMERA.wholePl, opt);
    else if (preset === "flank") map.fitBounds(CAMERA.flank, opt);
    else if (preset === "region") {
      const id = home || sel;
      const meta = VOIV_BOUNDS[id ?? ""] ?? VOIV_BOUNDS.mazowieckie;
      const neighbors = NEIGHBOR_BOUNDS[id ?? "mazowieckie"] ?? meta;
      map.fitBounds(neighbors, { ...opt, pitch: 0 });
    } else map.fitBounds(CAMERA.defaultBounds, opt);
  }, [preset, nonce]);

  // Pulse only while a fresh object is on the map and the page is visible, at ~15 fps:
  // every paint change forces a full map repaint, which drains a phone left on overnight.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const map = mapRef.current;
      if (t - last >= 66 && hasFresh.current && !document.hidden && map && ready.current && map.getLayer("obj-pulse")) {
        last = t;
        const s = 0.5 + 0.5 * Math.sin(t / 420);
        map.setPaintProperty("obj-pulse", "circle-opacity", 0.08 + 0.14 * s);
        map.setPaintProperty("obj-pulse", "circle-radius", 12 + 8 * s);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div ref={ref} className="map-root" aria-label="Zorya map" />;
}

/** "Show everything" button under the zoom buttons: frames Poland, Ukraine and the Baltics. */
class FitAllControl implements maplibregl.IControl {
  private el: HTMLDivElement | null = null;
  onAdd(map: MLMap) {
    const el = document.createElement("div");
    el.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "zorya-fit-all";
    const label = useStore.getState().lang === "en" ? "Show the whole map" : "Pokaż całą mapę";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    btn.addEventListener("click", () => {
      map.fitBounds(CAMERA.all, { padding: CAMERA.allPadding, duration: prefersReducedMotion() ? 0 : 700, pitch: 0 });
    });
    el.appendChild(btn);
    this.el = el;
    return el;
  }
  onRemove() {
    this.el?.remove();
    this.el = null;
  }
}

/** From this zoom powiaty carry the level colour; below it the voivodeships do. */
const POWIAT_ZOOM = 5;
/** From this zoom gmina borders are drawn and a tap opens the gmina. */
const GMINA_ZOOM = 7;
const LEVEL_COLOR: maplibregl.ExpressionSpecification = [
  "match",
  ["coalesce", ["feature-state", "paint"], "info"],
  "priority",
  COLORS.crimson,
  "watch",
  COLORS.amber,
  "transfer",
  COLORS.olive,
  COLORS.navy,
];

const LOCAL_ICON_SIZE = 0.55;
/** Badge spacing (px) and drop below the voivodeship centre (px). */
const LOCAL_GAP = 20;
const LOCAL_DY = 20;
const localDx = (k: number, i: number) => (i - (k - 1) / 2) * LOCAL_GAP;

/** Per-feature offsets via a lookup on `slot` (= count * 10 + index): GeoJSON properties cannot carry arrays. */
function slotMatch(fn: (k: number, i: number) => [number, number]): maplibregl.ExpressionSpecification {
  const m: unknown[] = ["match", ["get", "slot"]];
  for (let k = 1; k <= 6; k++) for (let i = 0; i < k; i++) m.push(k * 10 + i, ["literal", fn(k, i)]);
  m.push(["literal", [0, 0]]);
  return m as maplibregl.ExpressionSpecification;
}

function emptyFc(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function labelSize(density: "low" | "dense") {
  return density === "dense" ? 12 : 10;
}

function iconLabel(type: string) {
  return type === "shahed" ? "Shahed" : type;
}

const VOIV_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  dolnoslaskie: [
    [14.5, 50.1],
    [17.8, 51.9],
  ],
  "kujawsko-pomorskie": [
    [16.9, 52.3],
    [20.0, 53.9],
  ],
  lubelskie: [
    [21.6, 50.2],
    [24.2, 52.4],
  ],
  lubuskie: [
    [14.4, 51.3],
    [16.4, 53.1],
  ],
  lodzkie: [
    [17.9, 50.8],
    [20.8, 52.4],
  ],
  malopolskie: [
    [19.0, 49.1],
    [21.6, 50.5],
  ],
  mazowieckie: [
    [19.3, 51.0],
    [23.1, 53.5],
  ],
  opolskie: [
    [16.8, 50.0],
    [18.7, 51.2],
  ],
  podkarpackie: [
    [21.1, 49.0],
    [23.6, 50.9],
  ],
  podlaskie: [
    [21.6, 52.3],
    [24.1, 54.5],
  ],
  pomorskie: [
    [16.6, 53.5],
    [19.7, 55.1],
  ],
  slaskie: [
    [18.0, 49.4],
    [19.8, 51.2],
  ],
  swietokrzyskie: [
    [19.6, 50.2],
    [21.9, 51.3],
  ],
  "warminsko-mazurskie": [
    [19.1, 53.1],
    [22.8, 54.5],
  ],
  wielkopolskie: [
    [15.7, 51.1],
    [18.9, 53.1],
  ],
  zachodniopomorskie: [
    [14.1, 52.6],
    [16.9, 54.6],
  ],
};

const NEIGHBORS: Record<string, string[]> = {
  dolnoslaskie: ["lubuskie", "wielkopolskie", "opolskie"],
  "kujawsko-pomorskie": ["pomorskie", "warminsko-mazurskie", "mazowieckie", "lodzkie", "wielkopolskie"],
  lubelskie: ["podlaskie", "mazowieckie", "swietokrzyskie", "podkarpackie"],
  lubuskie: ["zachodniopomorskie", "wielkopolskie", "dolnoslaskie"],
  lodzkie: ["wielkopolskie", "kujawsko-pomorskie", "mazowieckie", "swietokrzyskie", "slaskie", "opolskie"],
  malopolskie: ["slaskie", "swietokrzyskie", "podkarpackie"],
  mazowieckie: ["warminsko-mazurskie", "podlaskie", "lubelskie", "swietokrzyskie", "lodzkie", "kujawsko-pomorskie"],
  opolskie: ["dolnoslaskie", "wielkopolskie", "lodzkie", "slaskie"],
  podkarpackie: ["malopolskie", "swietokrzyskie", "lubelskie"],
  podlaskie: ["warminsko-mazurskie", "mazowieckie", "lubelskie"],
  pomorskie: ["zachodniopomorskie", "wielkopolskie", "kujawsko-pomorskie", "warminsko-mazurskie"],
  slaskie: ["opolskie", "lodzkie", "swietokrzyskie", "malopolskie"],
  swietokrzyskie: ["mazowieckie", "lubelskie", "podkarpackie", "malopolskie", "slaskie", "lodzkie"],
  "warminsko-mazurskie": ["pomorskie", "kujawsko-pomorskie", "mazowieckie", "podlaskie"],
  wielkopolskie: ["zachodniopomorskie", "pomorskie", "kujawsko-pomorskie", "lodzkie", "opolskie", "dolnoslaskie", "lubuskie"],
  zachodniopomorskie: ["pomorskie", "wielkopolskie", "lubuskie"],
};

function expand(b: [[number, number], [number, number]], km = 80): [[number, number], [number, number]] {
  const dlat = km / 111;
  const midLat = (b[0][1] + b[1][1]) / 2;
  const dlon = km / (111 * Math.cos((midLat * Math.PI) / 180));
  return [
    [b[0][0] - dlon, b[0][1] - dlat],
    [b[1][0] + dlon, b[1][1] + dlat],
  ];
}

const NEIGHBOR_BOUNDS: Record<string, [[number, number], [number, number]]> = Object.fromEntries(
  Object.keys(VOIV_BOUNDS).map((id) => {
    const ids = [id, ...(NEIGHBORS[id] || [])];
    let minx = 40,
      miny = 60,
      maxx = 10,
      maxy = 40;
    for (const i of ids) {
      const b = VOIV_BOUNDS[i];
      if (!b) continue;
      minx = Math.min(minx, b[0][0]);
      miny = Math.min(miny, b[0][1]);
      maxx = Math.max(maxx, b[1][0]);
      maxy = Math.max(maxy, b[1][1]);
    }
    return [id, expand([[minx, miny], [maxx, maxy]], 80)];
  })
);
