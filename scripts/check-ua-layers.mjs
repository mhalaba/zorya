// Build-time guard for the Ukraine threat layers: validates the MapLibre layer specs against the style spec and
// checks that every icon name the map can ask for is registered (UA_SHAPES × {"", "-dead"}). Exits 1 on error.
import { build } from "esbuild";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";

const out = await build({
  stdin: {
    contents: `export { uaThreatLayers } from "./src/map/uaLayers.ts"; export { UA_SHAPES } from "./src/map/icons.ts"; export { uaIcon } from "./src/mapaua.ts";`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  external: ["maplibre-gl"],
  logLevel: "silent",
});
const mod = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const layers = mod.uaThreatLayers();
const fc = { type: "FeatureCollection", features: [] };
const style = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: { mua: { type: "geojson", data: fc }, "mua-lines": { type: "geojson", data: fc } },
  layers,
};
const errors = validateStyleMin(style).map((e) => e.message);
const names = new Set(Object.keys(mod.UA_SHAPES).flatMap((t) => [`mua-${t}`, `mua-${t}-dead`]));
const kinds = ["drone_piston", "drone_jet", "drone_fpv", "missile_cruise", "missile_ballistic", "bomb", "unknown"];
const subkinds = [null, "banderol", "kalibr", "x101", "iskander", "decoy"];
for (const kind of kinds)
  for (const subkind of subkinds)
    for (const status of ["active", "lost", "eliminated", "hit_target"]) {
      const n = mod.uaIcon({ kind, subkind, status });
      if (!names.has(n)) errors.push(`icon "${n}" (${kind}/${subkind}/${status}) is not registered`);
    }
if (!layers.some((l) => l.id === "mua-icon")) errors.push("mua-icon layer missing");
if (errors.length) {
  console.error("check-ua-layers: FAILED\n  " + errors.join("\n  "));
  process.exit(1);
}
console.log(`check-ua-layers: ok (${layers.length} layers, ${names.size} icons)`);
