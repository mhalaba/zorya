/**
 * Permanent airspace structure over Poland — prohibited (P), restricted (R), danger (D), TRA and TSA areas —
 * from the OpenAIP core API (free key: https://www.openaip.net). Off unless OPENAIP_API_KEY is set.
 * Refreshed once a day; whether an area is active right now comes from NOTAMs / the AUP, not from here.
 */
import { voivodeshipsForPoints } from "./fusion.mjs";
import { fetchText } from "./util.mjs";

const KEY = String(process.env.OPENAIP_API_KEY || "").trim();
export const AIRSPACE_ENABLED = !!KEY;
const BASE = (process.env.OPENAIP_BASE || "https://api.core.openaip.net/api").replace(/\/$/, "");
const EVERY_MS = 24 * 3600_000;
const RETRY_MS = 3600_000;

/** OpenAIP type code → [kind, short code, Polish label]. */
const TYPES = {
  1: ["restricted", "R", "strefa ograniczeń (R)"],
  2: ["danger", "D", "strefa niebezpieczna (D)"],
  3: ["prohibited", "P", "strefa zakazana (P)"],
  8: ["reserved", "TRA", "strefa czasowo rezerwowana (TRA)"],
  9: ["reserved", "TSA", "strefa czasowo wydzielona (TSA)"],
};

/** OpenAIP limit object { value, unit: 0 m | 1 ft | 6 FL, referenceDatum: 0 GND | 1 MSL | 2 STD }. */
export function limitLabel(l) {
  if (!l || typeof l.value !== "number") return null;
  if (l.unit === 6) return `FL${String(l.value).padStart(3, "0")}`;
  if (l.value === 0 && l.referenceDatum === 0) return "GND";
  const unit = l.unit === 0 ? "m" : "ft";
  const ref = l.referenceDatum === 0 ? "AGL" : l.referenceDatum === 1 ? "AMSL" : "STD";
  return `${l.value} ${unit} ${ref}`;
}

export function toZone(a) {
  const t = TYPES[a?.type];
  const g = a?.geometry;
  if (!t || !g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return null;
  const pts = g.type === "Polygon" ? g.coordinates[0] || [] : g.coordinates.flatMap((p) => p[0] || []);
  return {
    id: String(a._id || a.id || a.name).slice(0, 80),
    name: String(a.name || "").slice(0, 120),
    kind: t[0],
    code: t[1],
    label: t[2],
    lower: limitLabel(a.lowerLimit),
    upper: limitLabel(a.upperLimit),
    by_notam: !!a.byNotam,
    geometry: g,
    voivodeships: voivodeshipsForPoints(pts),
  };
}

let snap = {
  enabled: AIRSPACE_ENABLED,
  ok: false,
  source: "OpenAIP",
  fetched_at: null,
  error: AIRSPACE_ENABLED ? "jeszcze nie pobrano" : "wyłączone (brak OPENAIP_API_KEY)",
  items: [],
};
let timer = null;

async function load() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const text = await fetchText(`${BASE}/airspaces?country=PL&page=${page}&limit=500`, {
      timeout: 30000,
      max: 40 * 1024 * 1024,
      headers: { Accept: "application/json", "x-openaip-api-key": KEY },
    });
    const d = JSON.parse(text);
    const items = Array.isArray(d?.items) ? d.items : null;
    if (!items) throw new Error("brak items w odpowiedzi");
    for (const a of items) {
      const z = toZone(a);
      if (z) out.push(z);
    }
    if (page >= (Number(d.totalPages) || 1)) break;
  }
  return out;
}

async function poll() {
  let delay = EVERY_MS;
  try {
    const items = await load();
    snap = { ...snap, ok: true, error: null, fetched_at: new Date().toISOString(), items };
  } catch (err) {
    snap = { ...snap, ok: false, error: String(err.message || err).slice(0, 160) };
    console.error("Zorya OpenAIP", snap.error);
    delay = RETRY_MS;
  }
  timer = setTimeout(() => void poll(), delay);
  timer.unref?.();
}

export function startAirspace() {
  if (!AIRSPACE_ENABLED || timer) return;
  void poll();
}

export function airspaceSnapshot() {
  return snap;
}
