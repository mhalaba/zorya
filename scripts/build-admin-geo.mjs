#!/usr/bin/env node
/**
 * Builds the administrative boundary layers from PRG (Państwowy Rejestr Granic, Geoportal/GUGiK, August 2025,
 * public domain) as published, already reprojected to WGS84 and simplified (Visvalingam 5%), in
 * github.com/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy.
 *
 * One topology for all three levels: gminy are simplified once, powiaty and voivodeships are dissolved from them,
 * so the borders of the three layers coincide exactly on the map.
 *
 *   node scripts/build-admin-geo.mjs [sourceDir]     (needs network for the source files and `npx mapshaper`)
 *
 * Writes:
 *   public/geo/pl-admin.topojson         objects "woj" (16) and "powiaty" (380)  — loaded with the map
 *   public/geo/gminy/<voivodeship>.topojson   object "gminy", one file per voivodeship — loaded on demand
 *
 * public/geo/pl-voivodeships.geojson is NOT touched: the fusion measures distances to the border on it, and new
 * borders would shift every score. The map draws voivodeships from pl-admin.topojson (same topology as powiaty).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "https://raw.githubusercontent.com/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy/main";
const MAPSHAPER = ["--yes", "mapshaper@0.6.102"];
/** Share of removable vertices kept on top of the source's own 5% simplification. */
const KEEP = "45%";

const VOIV = {
  "02": ["dolnoslaskie", "dolnośląskie", 13], "04": ["kujawsko-pomorskie", "kujawsko-pomorskie", 8],
  "06": ["lubelskie", "lubelskie", 1], "08": ["lubuskie", "lubuskie", 14], "10": ["lodzkie", "łódzkie", 7],
  "12": ["malopolskie", "małopolskie", 6], "14": ["mazowieckie", "mazowieckie", 4], "16": ["opolskie", "opolskie", 12],
  "18": ["podkarpackie", "podkarpackie", 2], "20": ["podlaskie", "podlaskie", 0], "22": ["pomorskie", "pomorskie", 9],
  "24": ["slaskie", "śląskie", 10], "26": ["swietokrzyskie", "świętokrzyskie", 5],
  "28": ["warminsko-mazurskie", "warmińsko-mazurskie", 3], "30": ["wielkopolskie", "wielkopolskie", 11],
  "32": ["zachodniopomorskie", "zachodniopomorskie", 15],
};
const KIND = { 1: "miejska", 2: "wiejska", 3: "miejsko-wiejska" };

async function source(dir, name) {
  const file = path.join(dir, `${name}.json`);
  if (!fs.existsSync(file)) {
    const r = await fetch(`${SRC}/${name}.json`);
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function mapshaper(args) {
  execFileSync("npx", [...MAPSHAPER, ...args], { stdio: ["ignore", "inherit", "inherit"] });
}

const srcDir = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "prg-"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zorya-admin-"));
const gminy = await source(srcDir, "gminy");
const powiaty = await source(srcDir, "powiaty");

// Powiat names from PRG ("powiat kozienicki", "powiat Kraków" for cities with powiat rights).
const powName = new Map(powiaty.features.map((f) => [f.properties.JPT_KOD_JE, f.properties.JPT_NAZWA_]));

for (const f of gminy.features) {
  const id = f.properties.JPT_KOD_JE;
  const v = VOIV[id.slice(0, 2)];
  if (!v) throw new Error(`unknown voivodeship in ${id}`);
  f.properties = { id, name: f.properties.JPT_NAZWA_, kind: KIND[id[6]] || "inna", pow: id.slice(0, 4), woj: v[0], wt: id.slice(0, 2) };
}
fs.writeFileSync(path.join(tmp, "gminy.json"), JSON.stringify(gminy));

// Simplify the gmina topology once, then dissolve the higher levels from it.
mapshaper([
  "-i", path.join(tmp, "gminy.json"), "name=gminy",
  "-simplify", KEEP, "keep-shapes",
  "-clean",
  "-o", path.join(tmp, "gminy-s.json"), "format=geojson", "precision=0.0001",
]);
mapshaper([
  "-i", path.join(tmp, "gminy-s.json"), "name=gminy",
  "-dissolve", "pow", "copy-fields=woj", "+", "name=powiaty",
  "-target", "gminy",
  "-dissolve", "wt", "+", "name=woj",
  "-o", path.join(tmp, "admin.json"), "format=topojson", "quantization=100000", "target=powiaty,woj",
]);
// Properties of the higher levels.
const powProps = (code, woj) => {
  const raw = String(powName.get(code) || code).replace(/^powiat\s+/i, "");
  const city = Number(code.slice(2)) >= 61;
  return { id: code, name: raw, label: city ? `${raw} (miasto na prawach powiatu)` : `powiat ${raw}`, city, woj };
};
const wojProps = (wt) => ({ id: VOIV[wt][0], name: VOIV[wt][1], teryt: wt, east_rank: VOIV[wt][2] });

const admin = JSON.parse(fs.readFileSync(path.join(tmp, "admin.json"), "utf8"));
for (const g of admin.objects.powiaty.geometries) {
  g.properties = powProps(g.properties.pow, g.properties.woj);
  g.id = g.properties.id;
}
for (const g of admin.objects.woj.geometries) {
  g.properties = wojProps(g.properties.wt);
  g.id = g.properties.id;
}
const outGeo = path.join(root, "public/geo");
fs.writeFileSync(path.join(outGeo, "pl-admin.topojson"), JSON.stringify(admin));

// Gminy, one topology per voivodeship.
fs.mkdirSync(path.join(outGeo, "gminy"), { recursive: true });
for (const [wt, [slug]] of Object.entries(VOIV)) {
  const file = path.join(outGeo, "gminy", `${slug}.topojson`);
  mapshaper([
    "-i", path.join(tmp, "gminy-s.json"), "name=gminy",
    "-filter", `wt == "${wt}"`,
    "-filter-fields", "id,name,kind,pow,woj",
    "-o", file, "format=topojson", "quantization=100000", "id-field=id",
  ]);
}
console.log(`admin layers written to ${outGeo} (source ${srcDir})`);
