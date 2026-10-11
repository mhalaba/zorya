/**
 * Place and address search for the map.
 * - Typing (mode=quick): gminy and powiaty from the PRG boundaries, in memory — no third party sees the query.
 * - Enter (mode=full): additionally geocodes the address with GUGiK UUG (official PRG address points, srid=4326:
 *   x = lon, y = lat), and only when UUG finds nothing, with OpenStreetMap Nominatim (max 1 request/s, as its policy
 *   requires; never used for type-ahead). Every hit is placed in its gmina by our own boundaries.
 * Answers are cached for 10 minutes; the server is the only client of the geocoders (users' IPs never reach them).
 */
import { adminSearchEntries, fold, gminaAt, gminaInfo, unitsFromTeryt, gminaById } from "./admin.mjs";
import { envFlag, fetchText } from "./util.mjs";
import { VOIV } from "./fusion.mjs";

const VOIV_NAME = Object.fromEntries(VOIV.map((v) => [v.id, v.name]));

const UUG_URL = (process.env.ZORYA_UUG_URL || "https://services.gugik.gov.pl/uug/").replace(/\/?$/, "/");
const NOMINATIM_URL = process.env.ZORYA_NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";
export const GEOCODER_ENABLED = envFlag("ZORYA_GEOCODER_ENABLED");
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 1000;

const ENTRIES = adminSearchEntries().map((e) => ({ ...e, key: fold(e.name), words: fold(e.name).split(" ") }));

function hitFrom(e, score) {
  return {
    type: e.type,
    name: e.name,
    context: `${e.context}, woj. ${VOIV_NAME[e.voivodeship] ?? e.voivodeship}`,
    lat: e.lat,
    lon: e.lon,
    bbox: e.bbox,
    gmina: e.gmina,
    powiat: e.powiat,
    voivodeship: e.voivodeship,
    source: "PRG",
    score,
  };
}

/**
 * Gminy and powiaty matching the query: exact name, then prefix, then every word a prefix of a name word;
 * extra words may name the powiat or voivodeship ("Osiek olkuski", "Dobra małopolskie") to pick among namesakes.
 */
export function searchAdmin(q, limit = 8) {
  const f = fold(q);
  if (f.length < 2) return [];
  const tokens = f.split(" ");
  const out = [];
  for (const e of ENTRIES) {
    let score = 0;
    if (e.key === f) score = 100;
    else if (e.key.startsWith(f)) score = 80 - Math.min(20, e.key.length - f.length);
    else {
      // Leading tokens form the name, the rest must match the context.
      for (let n = tokens.length; n >= 1 && !score; n--) {
        const name = tokens.slice(0, n).join(" ");
        const rest = tokens.slice(n);
        if (!(e.key === name || e.key.startsWith(name))) continue;
        const ctx = fold(`${e.context} ${e.voivodeship} ${VOIV_NAME[e.voivodeship] ?? ""}`);
        if (rest.every((t) => ctx.split(" ").some((w) => w.startsWith(t)))) score = (e.key === name ? 70 : 50) + n;
      }
      if (!score && tokens.every((t) => e.words.some((w) => w.startsWith(t)))) score = 40;
    }
    if (!score) continue;
    // A town's urban gmina before the rural one of the same name, gminy before powiaty.
    if (e.type === "gmina" && /miejska/.test(e.context) && !/wiejska/.test(e.context)) score += 3;
    if (e.type === "powiat") score -= 2;
    out.push(hitFrom(e, score));
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pl")).slice(0, limit);
}

/**
 * UUG wants "Miejscowość, Ulica Numer". People type "Lublin Krakowskie Przedmieście 10/2, 20-002": drop the postal
 * code and flat number, and put the comma after the longest leading words that name a gmina or town.
 */
export function uugQuery(q) {
  let s = String(q || "")
    .replace(/\b\d{2}-\d{3}\b/g, " ")
    .replace(/(\d+[a-zA-Z]?)\s*(?:\/|m\.|lok\.?)\s*\d+[a-zA-Z]?/g, "$1")
    .replace(/(?<![\p{L}\d])(?:ul\.?|ulica|al\.?|aleja|pl\.?|plac|os\.?|osiedle)\s+/giu, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim()
    .replace(/^,|,$/g, "")
    .trim();
  if (!s || s.includes(",")) return s;
  const words = s.split(" ");
  const isTown = (ws) => ENTRIES.some((e) => e.type === "gmina" && e.key === fold(ws.join(" ")));
  for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
    if (isTown(words.slice(0, n))) return `${words.slice(0, n).join(" ")}, ${words.slice(n).join(" ")}`;
  }
  // "Marszałkowska 1 Warszawa": the town at the end moves to the front.
  for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
    if (isTown(words.slice(-n))) return `${words.slice(-n).join(" ")}, ${words.slice(0, -n).join(" ")}`;
  }
  return s;
}

function placeHit({ type, name, context, lat, lon, source, teryt }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const g = gminaAt(lat, lon) || (teryt ? gminaById(unitsFromTeryt([teryt]).gminy[0]) : null);
  const info = g ? gminaInfo(g) : null;
  return {
    type,
    name,
    context: info ? `${context ? `${context}, ` : ""}gm. ${info.name}, ${info.powiat.label}` : context || "",
    lat: Math.round(lat * 1e6) / 1e6,
    lon: Math.round(lon * 1e6) / 1e6,
    bbox: null,
    gmina: info?.id ?? null,
    powiat: info?.powiat.id ?? null,
    voivodeship: info?.voivodeship ?? null,
    source,
    score: 0,
  };
}

/** UUG GetAddress JSON → hits ("results" is an object keyed "1".."N", or null). */
export function parseUug(json) {
  const type = String(json?.type || "");
  const rows = json?.results && typeof json.results === "object" ? Object.values(json.results) : [];
  return rows
    .map((r) => {
      const lon = Number(r?.x);
      const lat = Number(r?.y);
      const city = String(r?.city || "").trim();
      const street = String(r?.street || "").trim();
      const number = String(r?.number || "").trim();
      const name =
        type === "address" ? [street || city, number].filter(Boolean).join(" ") + (street ? `, ${city}` : "") : type === "street" ? `${street}, ${city}` : city;
      const kind = type === "address" ? "address" : type === "street" ? "street" : "city";
      return placeHit({ type: kind, name: name || city, context: r?.code ? `${r.code} ${city}`.trim() : "", lat, lon, source: "GUGiK (PRG)", teryt: r?.teryt });
    })
    .filter(Boolean);
}

/** Nominatim jsonv2 → hits. */
export function parseNominatim(list) {
  return (Array.isArray(list) ? list : [])
    .map((r) => {
      const hit = placeHit({
        type: "osm",
        name: String(r?.name || r?.display_name || "").split(",")[0],
        context: String(r?.display_name || "").split(",").slice(1, 3).join(",").trim(),
        lat: Number(r?.lat),
        lon: Number(r?.lon),
        source: "OpenStreetMap",
      });
      const b = (r?.boundingbox || []).map(Number); // [south, north, west, east]
      if (hit && b.length === 4 && b.every(Number.isFinite)) hit.bbox = [b[2], b[0], b[3], b[1]];
      return hit;
    })
    .filter(Boolean);
}

const cache = new Map();
function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = fn().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), value });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
}

async function uug(q) {
  const url = `${UUG_URL}?request=GetAddress&address=${encodeURIComponent(q)}&srid=4326`;
  const text = await fetchText(url, { timeout: 10_000, max: 2 * 1024 * 1024, headers: { Accept: "application/json" } });
  return parseUug(JSON.parse(text));
}

// Nominatim usage policy: at most one request per second from the whole server.
let nominatimNext = 0;
async function nominatim(q) {
  if (!NOMINATIM_URL) return [];
  const wait = nominatimNext - Date.now();
  // A backlog means someone is flooding: answer "busy" instead of making real users wait minutes.
  if (wait > 4000) throw new Error("zajęty, spróbuj za chwilę");
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const u = new URL(NOMINATIM_URL);
  for (const [k, v] of Object.entries({ q, format: "jsonv2", countrycodes: "pl", addressdetails: "1", "accept-language": "pl", limit: "5" })) u.searchParams.set(k, v);
  const text = await fetchText(u.toString(), { timeout: 10_000, max: 1024 * 1024, headers: { Accept: "application/json" } });
  return parseNominatim(JSON.parse(text));
}

/** Full search: names first, then the address geocoders. Errors of a geocoder are reported, not thrown. */
export async function search(q, mode = "quick") {
  const query = String(q || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const local = searchAdmin(query);
  if (mode !== "full" || !GEOCODER_ENABLED || query.length < 3) return { query, results: local, errors: [] };
  const errors = [];
  let geo = [];
  const uq = uugQuery(query);
  try {
    geo = await cached(`uug:${fold(uq)}`, () => uug(uq));
  } catch (err) {
    errors.push(`GUGiK: ${String(err.message || err).slice(0, 80)}`);
  }
  if (!geo.length) {
    try {
      geo = await cached(`osm:${fold(query)}`, () => nominatim(query));
    } catch (err) {
      errors.push(`OSM: ${String(err.message || err).slice(0, 80)}`);
    }
  }
  // An exact address first; a gmina whose name equals the query stays on top of a same-named town point.
  const exact = local.filter((h) => h.score >= 100);
  return { query, results: [...exact, ...geo, ...local.filter((h) => h.score < 100)].slice(0, 12), errors };
}
