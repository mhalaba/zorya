import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CAMERA, COLORS } from "../config";
import { circlePoly, destPoint, prefersReducedMotion } from "../lib";
import { iconForType, registerMapIcons } from "./icons";
import { useStore } from "../store";
import type { FusionState, VoivodeshipState } from "../types";
import type { FeatureCollection } from "geojson";

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
  const showPazp = useStore((s) => s.showPazp);
  const showTracks = useStore((s) => s.showTracks);
  const pitch3d = useStore((s) => s.pitch3d);
  const labelDensity = useStore((s) => s.labelDensity);
  const preset = useStore((s) => s.cameraPreset);
  const nonce = useStore((s) => s.cameraNonce);
  const historyMode = useStore((s) => s.historyMode);
  const history = useStore((s) => s.history);
  const historyIdx = useStore((s) => s.historyIdx);
  const lang = useStore((s) => s.lang);
  const showCivAdsb = useStore((s) => s.showCivAdsb);
  const showMilAdsb = useStore((s) => s.showMilAdsb);
  const showNeptun = useStore((s) => s.showNeptun);
  const showUaAlerts = useStore((s) => s.showUaAlerts);

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
      });
    } catch (err) {
      console.error("Zorya map init", err);
      return;
    }
    mapRef.current = map;
    map.on("error", (e) => console.error("Zorya map", e.error || e));
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

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
      map.addSource("adsb", { type: "geojson", data: emptyFc() });
      map.addSource("zones", { type: "geojson", data: emptyFc() });
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
          "fill-color": [
            "match",
            ["coalesce", ["feature-state", "paint"], "info"],
            "priority",
            COLORS.crimson,
            "watch",
            COLORS.amber,
            "transfer",
            COLORS.olive,
            COLORS.navy,
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.72,
            ["match", ["coalesce", ["feature-state", "paint"], "info"], "priority", 0.45, "watch", 0.35, "transfer", 0.2, 0.42],
          ],
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
        layout: { visibility: initial.showPazp ? "visible" : "none" },
        paint: {
          "fill-color": ["match", ["get", "kind"], "score", "#E0A100", "#9AA8B8"],
          "fill-opacity": 0.22,
        },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: "zones",
        layout: { visibility: initial.showPazp ? "visible" : "none" },
        paint: {
          "line-color": ["match", ["get", "kind"], "score", COLORS.amber, "#9AA8B8"],
          "line-width": 1.2,
        },
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
      map.on("click", "pl-fill", (e) => {
        const id = String(e.features?.[0]?.id ?? "");
        const st = useStore.getState();
        st.setSelectedVoiv(id);
        st.setDrawer({ kind: "voiv", id });
      });
      map.on("click", "obj-icon", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) useStore.getState().setDrawer({ kind: "object", id: String(id) });
      });
      const openAdsb = (e: { features?: { properties?: { id?: string } }[] }) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) useStore.getState().setDrawer({ kind: "adsb", id: String(id) });
      };
      map.on("click", "adsb-civ", openAdsb);
      map.on("click", "adsb-mil", openAdsb);
      for (const layer of ["adsb-civ", "adsb-mil", "obj-icon"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      map.on("click", "zones-fill", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) useStore.getState().setDrawer({ kind: "zone", id: String(id) });
      });
      map.on("click", "cam-icon", () => useStore.getState().setDrawer({ kind: "cameras" }));
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
      applyData(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const {
      state: st,
      historyMode: histMode,
      history: bundle,
      historyIdx: idx,
      showNeptun: neptunOn,
      showUaAlerts: uaOn,
      showCivAdsb: civOn,
      showMilAdsb: milOn,
      showTracks: tracksOn,
    } = useStore.getState();
    const histPts =
      histMode && bundle
        ? Object.fromEntries(Object.entries(bundle.voivodeships).map(([id, arr]) => [id, arr[idx] ?? 0]))
        : null;
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

    const camFc: FeatureCollection = {
      type: "FeatureCollection",
      features: (st?.cameras ?? []).map((c) => ({
        type: "Feature" as const,
        properties: { id: c.id, name: c.name },
        geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
      })),
    };
    (map.getSource("cameras") as GeoJSONSource | undefined)?.setData(camFc);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    applyData(map);
  }, [state, showTracks, historyMode, history, historyIdx, showCivAdsb, showMilAdsb, showNeptun, showUaAlerts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    applyFocus(map);
  }, [hover, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const vis = showPazp ? "visible" : "none";
    if (map.getLayer("zones-fill")) map.setLayoutProperty("zones-fill", "visibility", vis);
    if (map.getLayer("zones-line")) map.setLayoutProperty("zones-line", "visibility", vis);
  }, [showPazp]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    map.easeTo({ pitch: pitch3d ? 48 : 0, bearing: pitch3d ? -8 : 0, duration: prefersReducedMotion() ? 0 : 420 });
  }, [pitch3d]);

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
    const { homeVoiv: home, selectedVoiv: sel, pitch3d: tilted } = useStore.getState();
    const opt = { padding: CAMERA.padding, duration: prefersReducedMotion() ? 0 : 700, pitch: tilted ? 48 : 0 };
    if (preset === "pl") map.fitBounds(CAMERA.wholePl, opt);
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
