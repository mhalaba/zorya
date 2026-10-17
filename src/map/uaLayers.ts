import type { LayerSpecification } from "maplibre-gl";

/**
 * MapLibre layers for Ukraine threats. Kept free of DOM/React so scripts/check-ua-layers.mjs can validate them
 * against the style spec during the build: an invalid expression makes MapLibre drop the whole layer silently
 * (cf8b04e: a "zoom" interpolate nested in a "case" → no icons at all, only trails).
 * Feature properties: icon, heading, dead, sel, fb (fallback source), fr (freshness 0..1), amount, color, role.
 */
export function uaThreatLayers(): LayerSpecification[] {
  return [
    {
      id: "mua-trail",
      type: "line",
      source: "mua-lines",
      filter: ["==", ["get", "role"], "trail"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["case", ["get", "dead"], "#6B7480", ["get", "color"]],
        // mapa.ua-style: the trail fades with the object's age; the selected one is fully lit.
        "line-opacity": ["case", ["get", "sel"], 1, ["*", ["get", "fr"], ["case", ["get", "dead"], 0.5, ["get", "fb"], 0.55, 0.85]]],
        "line-width": ["case", ["get", "sel"], 3.4, ["get", "dead"], 1.4, 2.2],
      },
    },
    {
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
    },
    {
      id: "mua-icon",
      type: "symbol",
      source: "mua",
      layout: {
        "icon-image": ["get", "icon"],
        // 96 px canvas at pixelRatio 2 = 48 px → ~22-32 px on screen; lost / shot down smaller (like mapa.ua).
        // "zoom" must be the input of a TOP-LEVEL interpolate, so the per-feature case sits inside each stop.
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["case", ["get", "sel"], 0.74, ["get", "dead"], 0.4, 0.56],
          6,
          ["case", ["get", "sel"], 0.82, ["get", "dead"], 0.46, 0.64],
          9,
          ["case", ["get", "sel"], 0.92, ["get", "dead"], 0.54, 0.74],
        ],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotate": ["get", "heading"],
        "icon-rotation-alignment": "map",
        "symbol-sort-key": ["case", ["get", "dead"], 0, 1],
        // Group size badge ("×4") next to the icon.
        "text-field": ["case", [">", ["get", "amount"], 1], ["concat", "×", ["to-string", ["get", "amount"]]], ""],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 13, 8, 15],
        "text-offset": [1.15, -0.85],
        "text-anchor": "left",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-optional": true,
        "text-rotation-alignment": "viewport",
      },
      paint: {
        // Fades with age like mapa.ua; fallback objects (MAPA.UA / NEPTUN) a little fainter than our own.
        "icon-opacity": ["*", ["get", "fr"], ["case", ["get", "fb"], 0.8, 1]],
        "text-color": "#FFFFFF",
        "text-halo-color": "#070B12",
        "text-halo-width": 2.4,
        "text-halo-blur": 0.3,
        "text-opacity": ["get", "fr"],
      },
    },
  ];
}
