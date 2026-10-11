/**
 * Polish administrative units below the voivodeship: 380 powiaty and 2479 gminy (PRG, Geoportal 2025, built by
 * scripts/build-admin-geo.mjs). Point → gmina/powiat lookups, area → units (NOTAM/AUP zones, outage points),
 * powiat neighbours from the shared topology, an interior anchor point per unit, and a name index for search.
 * Loaded once at start-up (~2 MB of TopoJSON); a missing file degrades to "no detail", never to a crash.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { feature, neighbors } = require("topojson-client");

const GEO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/geo");
const CELL = 0.1; // grid index cell, degrees

function polygonsOf(g) {
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

function bboxOf(polygons) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const rings of polygons)
    for (const [x, y] of rings[0] || []) {
      if (x < a) a = x;
      if (y < b) b = y;
      if (x > c) c = x;
      if (y > d) d = y;
    }
  return [a, b, c, d];
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inPolygons(lon, lat, polygons) {
  return polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h)));
}

const inBox = (lon, lat, b) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
const boxesOverlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

function ringArea(ring) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(s / 2);
}

/**
 * A point guaranteed inside the unit (for badges and distances): the area centroid of the largest part when it
 * lies inside, else the middle of the widest inside span on a horizontal line through that part.
 */
export function interiorPoint(polygons) {
  if (!polygons.length) return null;
  const main = polygons.reduce((best, p) => (ringArea(p[0]) > ringArea(best[0]) ? p : best));
  const ring = main[0];
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  if (a) {
    const c = [cx / (3 * a), cy / (3 * a)];
    if (inPolygons(c[0], c[1], [main])) return c.map((v) => Math.round(v * 1e5) / 1e5);
  }
  const [, b, , d] = bboxOf([main]);
  for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const lat = b + (d - b) * t;
    const xs = [];
    for (const r of main)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if (yi > lat !== yj > lat) xs.push(((xj - xi) * (lat - yi)) / (yj - yi) + xi);
      }
    xs.sort((p, q) => p - q);
    let best = null;
    for (let k = 0; k + 1 < xs.length; k += 2) if (!best || xs[k + 1] - xs[k] > best[1] - best[0]) best = [xs[k], xs[k + 1]];
    if (best) return [Math.round(((best[0] + best[1]) / 2) * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
  }
  return ring[0];
}

/**
 * Area-weighted centroid of all parts, holes subtracted — the distance point for scoring. (The anchor is only for
 * drawing: for ring powiaty around a city it lies 8–21 km off, which would skew distances.)
 */
export function areaCentroid(polygons) {
  let cx = 0, cy = 0, a = 0;
  for (const rings of polygons)
    rings.forEach((ring, k) => {
      const sign = k === 0 ? 1 : -1;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const f = (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]) * sign;
        cx += (ring[j][0] + ring[i][0]) * f;
        cy += (ring[j][1] + ring[i][1]) * f;
        a += f;
      }
    });
  if (!a) return null;
  return [Math.round((cx / (3 * a)) * 1e5) / 1e5, Math.round((cy / (3 * a)) * 1e5) / 1e5].map(Math.abs);
}

function readTopo(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function load() {
  const powiaty = [];
  const gminy = [];
  const powiatNeighbors = new Map();
  try {
    const admin = readTopo(path.join(GEO, "pl-admin.topojson"));
    const fc = feature(admin, admin.objects.powiaty);
    const nb = neighbors(admin.objects.powiaty.geometries);
    fc.features.forEach((f, i) => {
      const polygons = polygonsOf(f.geometry);
      powiaty.push({ ...f.properties, polygons, bbox: bboxOf(polygons), anchor: interiorPoint(polygons), centroid: areaCentroid(polygons) });
      powiatNeighbors.set(f.properties.id, nb[i].map((k) => admin.objects.powiaty.geometries[k].properties.id));
    });
    const dir = path.join(GEO, "gminy");
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".topojson")).sort()) {
      const t = readTopo(path.join(dir, name));
      for (const f of feature(t, t.objects.gminy).features) {
        const polygons = polygonsOf(f.geometry);
        gminy.push({ ...f.properties, polygons, bbox: bboxOf(polygons), anchor: interiorPoint(polygons) });
      }
    }
  } catch (err) {
    console.error("Zorya: brak granic gmin/powiatów —", err.message || err);
  }
  return { powiaty, gminy, powiatNeighbors };
}

const DATA = load();
const POWIAT_BY_ID = new Map(DATA.powiaty.map((p) => [p.id, p]));
const GMINA_BY_ID = new Map(DATA.gminy.map((g) => [g.id, g]));

// Grid index: cell → gmina indices whose bbox touches the cell.
const GRID = new Map();
DATA.gminy.forEach((g, i) => {
  const [a, b, c, d] = g.bbox;
  for (let x = Math.floor(a / CELL); x <= Math.floor(c / CELL); x++)
    for (let y = Math.floor(b / CELL); y <= Math.floor(d / CELL); y++) {
      const k = `${x}:${y}`;
      if (!GRID.has(k)) GRID.set(k, []);
      GRID.get(k).push(i);
    }
});

export const ADMIN_READY = DATA.gminy.length > 0;

/** Plain description of a unit (no geometry) for API answers and panels. */
export function gminaInfo(g) {
  if (!g) return null;
  const p = POWIAT_BY_ID.get(g.pow);
  return {
    id: g.id,
    name: g.name,
    kind: g.kind,
    label: `${g.name} (gmina ${g.kind})`,
    powiat: p ? { id: p.id, name: p.name, label: p.label } : { id: g.pow, name: g.pow, label: g.pow },
    voivodeship: g.woj,
    anchor: g.anchor,
    bbox: g.bbox,
  };
}

export function powiatInfo(p) {
  if (!p) return null;
  return { id: p.id, name: p.name, label: p.label, city: !!p.city, voivodeship: p.woj, anchor: p.anchor, bbox: p.bbox };
}

/** Gmina record containing the point (lat, lon), or null outside Poland / without data. */
export function gminaAt(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const cell = GRID.get(`${Math.floor(lon / CELL)}:${Math.floor(lat / CELL)}`);
  if (!cell) return null;
  for (const i of cell) {
    const g = DATA.gminy[i];
    if (inBox(lon, lat, g.bbox) && inPolygons(lon, lat, g.polygons)) return g;
  }
  return null;
}

export function powiatAt(lat, lon) {
  const g = gminaAt(lat, lon);
  return g ? POWIAT_BY_ID.get(g.pow) || null : null;
}

export const gminaById = (id) => GMINA_BY_ID.get(String(id)) || null;
export const powiatById = (id) => POWIAT_BY_ID.get(String(id)) || null;
export const powiatNeighbors = (id) => DATA.powiatNeighbors.get(String(id)) || [];
export const allPowiaty = () => DATA.powiaty;
export const allGminy = () => DATA.gminy;

function segX(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

/** Any zone edge crossing any ring edge of the unit (bbox-prefiltered per edge). */
function crosses(edges, polygons) {
  for (const rings of polygons)
    for (const r of rings)
      for (let i = 1; i < r.length; i++) {
        const a = r[i - 1], b = r[i];
        for (const [c, d] of edges) {
          if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])) continue;
          if (Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) continue;
          if (segX(a, b, c, d)) return true;
        }
      }
  return false;
}

/** Gminy (7-digit TERYT) and powiaty (4-digit) touched by a set of [lon, lat] points, sorted. */
export function unitsForPoints(points) {
  const g = new Set();
  for (const p of points || []) {
    const hit = gminaAt(p[1], p[0]);
    if (hit) g.add(hit.id);
  }
  const gminy = [...g].sort();
  return { gminy, powiaty: [...new Set(gminy.map((id) => id.slice(0, 4)))].sort() };
}

/**
 * Units overlapped by an area (NOTAM / AUP polygon): a gmina counts when a vertex of the area lies inside it or
 * its own interior point lies inside the area — so both small zones and large ones covering whole gminy are found.
 */
export function unitsForGeometry(geometry, extraPoints = []) {
  const polys = polygonsOf(geometry);
  if (!polys.length) return unitsForPoints(extraPoints);
  const box = bboxOf(polys);
  const hit = new Set(unitsForPoints([...polys.flatMap((rings) => rings[0]), ...extraPoints]).gminy);
  const zoneEdges = polys.flatMap((rings) => rings.flatMap((r) => r.slice(1).map((p, i) => [r[i], p])));
  for (const g of DATA.gminy) {
    if (hit.has(g.id) || !g.anchor || !boxesOverlap(g.bbox, box)) continue;
    // Inside the zone (anchor), or a zone edge crossing the gmina border (partial overlap).
    if (inPolygons(g.anchor[0], g.anchor[1], polys) || crosses(zoneEdges, g.polygons)) hit.add(g.id);
  }
  const gminy = [...hit].sort();
  return { gminy, powiaty: [...new Set(gminy.map((id) => id.slice(0, 4)))].sort() };
}

// ---- name index for search -----------------------------------------------------------------------

/** Lower-case, no diacritics, single spaces: "Bielsko-Biała" → "bielsko biala". */
export function fold(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Search entries for gminy and powiaty (localities and addresses are added by server/places.mjs). */
export function adminSearchEntries() {
  const out = [];
  for (const g of DATA.gminy) {
    const p = POWIAT_BY_ID.get(g.pow);
    out.push({
      type: "gmina",
      id: g.id,
      name: g.name,
      context: `gmina ${g.kind}${p ? `, ${p.label}` : ""}`,
      voivodeship: g.woj,
      gmina: g.id,
      powiat: g.pow,
      lat: g.anchor?.[1],
      lon: g.anchor?.[0],
      bbox: g.bbox,
    });
  }
  for (const p of DATA.powiaty) {
    out.push({
      type: "powiat",
      id: p.id,
      name: p.city ? p.name : `powiat ${p.name}`,
      context: p.city ? "miasto na prawach powiatu" : "powiat",
      voivodeship: p.woj,
      gmina: null,
      powiat: p.id,
      lat: p.anchor?.[1],
      lon: p.anchor?.[0],
      bbox: p.bbox,
    });
  }
  return out;
}

// ---- localisation of alerts ----------------------------------------------------------------------

const GMINA_BY_PREFIX6 = new Map(DATA.gminy.map((g) => [g.id.slice(0, 6), g.id]));
const sortUnits = (g, p) => {
  for (const id of g) p.add(id.slice(0, 4));
  return { gminy: [...g].sort(), powiaty: [...p].sort() };
};

/**
 * Units from TERYT codes of any length: 7 digits (gmina WWPPGGR) or 6 (without the type digit) → gmina,
 * 4 → powiat; 2 (voivodeship) adds nothing below the voivodeship.
 */
export function unitsFromTeryt(codes) {
  const g = new Set();
  const p = new Set();
  for (const raw of codes || []) {
    const c = String(raw ?? "").replace(/\D/g, "");
    if (c.length >= 6) {
      const id = GMINA_BY_ID.has(c.slice(0, 7)) ? c.slice(0, 7) : GMINA_BY_PREFIX6.get(c.slice(0, 6));
      if (id) g.add(id);
    } else if (c.length === 4 && POWIAT_BY_ID.has(c)) p.add(c);
  }
  return sortUnits(g, p);
}

/** Adjective stem of a powiat name: "zamojski" → "zamojsk", "Kraków" → "krakow". */
const powStem = (name) => fold(name).replace(/(?:i|y)$/, "");
const CAP = "[A-ZŁŚŻŹĆŃÓĘĄ][\\p{L}-]+";
const NAME = `(${CAP}(?:\\s+(?:${CAP}|nad|pod|w|k\\.)){0,3})`;
const RX_POWIAT = /[Pp]owi(?:at|atu|atem|ecie|aty|atów|atach)\s+((?:[\p{L}-]+[\s,]+(?:i\s+)?){0,1}[\p{L}-]+)/gu;
// Keywords may open a sentence ("Gmina Hrubieszów informuje"); the name itself must still be capitalised.
const RX_GMINA = new RegExp(`[Gg]min(?:a|y|ie|ę|ą|om|ach)\\s+(?:miejsk\\p{L}*\\s+|wiejsk\\p{L}*\\s+|miejsko-wiejsk\\p{L}*\\s+)?${NAME}`, "gu");
const RX_TOWN = new RegExp(`(?:[Mm]iejscowo\\p{L}*|[Mm]iast(?:o|a|em|u)|m\\.|[Ww]si|[Ww]ieś)\\s+${NAME}`, "gu");

/**
 * Gminy and powiaty named in a notice ("gmina Wola Uhruska", "w powiecie zamojskim", "miejscowość Hrubieszów"),
 * looked up only inside the given voivodeships (names repeat across Poland: four gminy are called Osiek).
 * Without a voivodeship a name counts only when it is unique in Poland.
 */
export function unitsFromText(text, voivodeships = []) {
  const t = String(text || "");
  const inScope = (woj) => !voivodeships.length || voivodeships.includes(woj);
  const g = new Set();
  const p = new Set();
  for (const m of t.matchAll(RX_POWIAT)) {
    // Hyphenated names ("kędzierzyńsko-kozielski") stay one word: compare without spaces on both sides.
    for (const word of m[1].split(/[\s,]+/).filter((w) => w !== "i").map((w) => fold(w).replace(/ /g, "")).filter((w) => w.length >= 4)) {
      let hits = DATA.powiaty.filter((x) => !x.city && inScope(x.woj) && word.startsWith(powStem(x.name).replace(/ /g, "")));
      // "strzelecko-drezdenecki" also starts with "strzelecki"'s stem: the longest stem is the named one.
      const longest = Math.max(0, ...hits.map((x) => powStem(x.name).length));
      hits = hits.filter((x) => powStem(x.name).length === longest);
      if (hits.length === 1 || (hits.length && voivodeships.length)) hits.forEach((x) => p.add(x.id));
    }
  }
  /** prefer: "town" (miasto / miejscowość), "rural" (gmina wiejska), "urban" (gmina miejska) or null. */
  const byName = (name, prefer) => {
    const f = fold(name);
    const hits = DATA.gminy.filter((x) => fold(x.name) === f && inScope(x.woj));
    // One place only: all hits in one powiat (a town and the rural gmina around it often share the name,
    // "Hrubieszów" miejska + wiejska). Hits in several powiaty are ambiguous: skipped.
    if (!hits.length || new Set(hits.map((x) => x.pow)).size !== 1) return false;
    const town = hits.filter((x) => x.kind !== "wiejska");
    const rural = hits.filter((x) => x.kind === "wiejska");
    const pick = prefer === "rural" && rural.length ? rural : (prefer === "town" || prefer === "urban") && town.length ? town : hits;
    pick.forEach((x) => g.add(x.id));
    return true;
  };
  // "gmina Wola Uhruska i Włodawa": try the longest name first, then shorter prefixes.
  const longest = (words, prefer) => {
    for (let n = words.length; n >= 1; n--) if (byName(words.slice(0, n).join(" "), prefer)) return;
  };
  for (const m of t.matchAll(RX_GMINA)) {
    const q = m[0].slice(0, m[0].length - m[1].length);
    longest(m[1].split(/\s+/), /wiejsk/i.test(q) && !/miejsko-/i.test(q) ? "rural" : /miejsk/i.test(q) && !/miejsko-/i.test(q) ? "urban" : null);
  }
  for (const m of t.matchAll(RX_TOWN)) longest(m[1].split(/\s+/), "town");
  return sortUnits(g, p);
}

/** Merge unit sets (de-duplicated, sorted). */
export function mergeUnits(...sets) {
  const g = new Set();
  const p = new Set();
  for (const s of sets) {
    for (const id of s?.gminy || []) g.add(id);
    for (const id of s?.powiaty || []) p.add(id);
  }
  return sortUnits(g, p);
}
