/**
 * Airspace use plan of PAŻP (Polish ANSP) — AUP/UUP — from the public map at airspace.pansa.pl: which TSA/TRA,
 * D, R and ad-hoc areas are reserved today and tomorrow, with altitudes, times, unit and remarks, plus the area
 * geometry. Read every 20 min. Shown in the airspace layer next to NOTAMs, in the same item shape.
 * Informational only: it is NOT fed to the fusion (input.zones stays empty), so it never changes a voivodeship level.
 */
import { voivodeshipsForPoints } from "./fusion.mjs";
import { envFlag, fetchText } from "./util.mjs";

export const AUP_ENABLED = envFlag("ZORYA_AUP_ENABLED");
const BASE = (process.env.ZORYA_AUP_BASE || "https://airspace.pansa.pl").replace(/\/$/, "");
const EVERY_MS = 20 * 60_000;
const MAX_BACKOFF_MS = 3 * 3600_000;
export const AUP_LINK = "https://airspace.pansa.pl/aup/current";

/** PANSA element type → [Notam category, Polish label]. Categories outside MAP_CATS stay on the list only. */
const TYPES = {
  TSA: ["reserved", "strefa czasowo wydzielona (TSA)"],
  TRA: ["reserved", "strefa czasowo rezerwowana (TRA)"],
  MRT: ["reserved", "trasa wojskowa (MRT)"],
  D: ["danger", "strefa niebezpieczna (D)"],
  R: ["restricted", "strefa ograniczeń (R)"],
  P: ["prohibited", "strefa zakazana (P)"],
  ADHOC: ["temporary", "strefa ad hoc"],
  NPZ: ["temporary", "strefa NPZ"],
  EA: ["exercise", "obszar ćwiczeń (EA)"],
  ATZ: ["airspace", "strefa ruchu lotniska (ATZ)"],
};
const MAP_CATS = new Set(["reserved", "danger", "restricted", "prohibited", "temporary", "exercise"]);

/** "GND" / "A061" (×100 ft AMSL) / "F145" (FL) → label. */
export function altLabel(v) {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  let m = s.match(/^A(\d{3})$/);
  if (m) return `${Number(m[1]) * 100} ft AMSL`;
  m = s.match(/^F(\d{3})$/);
  if (m) return `FL${m[1]}`;
  return s.slice(0, 20);
}

const round = (g) =>
  JSON.parse(JSON.stringify(g), (_k, v) => (typeof v === "number" ? Math.round(v * 1e5) / 1e5 : v));

function pointsOf(g) {
  if (!g) return [];
  if (g.type === "Polygon") return g.coordinates.flat();
  if (g.type === "MultiPolygon") return g.coordinates.flat(2);
  return [];
}

function bboxOf(pts) {
  if (!pts.length) return null;
  let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    a = Math.min(a, x);
    b = Math.min(b, y);
    c = Math.max(c, x);
    d = Math.max(d, y);
  }
  return [a, b, c, d].map((n) => Math.round(n * 1e4) / 1e4);
}

/** One GeoJSON feature of the PANSA map → NOTAM-shaped items, one per reservation. */
export function aupItems(feature, plan = "UUP") {
  const p = feature?.properties || {};
  const g = feature?.geometry;
  const designator = String(p.designator || "").trim();
  if (!designator || !g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return [];
  const type = String(p.airspaceElementType || "").toUpperCase();
  const [category, label] = TYPES[type] || ["other", type ? `strefa ${type}` : "strefa"];
  const geometry = round(g);
  const pts = pointsOf(geometry);
  const c = Array.isArray(p.centroid) ? p.centroid[0] : null;
  const center = c && Number.isFinite(c.x) && Number.isFinite(c.y) ? [Math.round(c.x * 1e5) / 1e5, Math.round(c.y * 1e5) / 1e5] : null;
  const voivodeships = voivodeshipsForPoints(center ? [...pts, center] : pts);
  const out = [];
  for (const r of Array.isArray(p.airspaceReservations) ? p.airspaceReservations : []) {
    const from = Date.parse(r.startDate);
    const to = Date.parse(r.endDate);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;
    const lower = altLabel(r.lowerAltitude);
    const upper = altLabel(r.upperAltitude);
    const status = String(r.reservationStatus || "").toUpperCase();
    const statusLabel = status === "PLANNED" ? `zaplanowana w ${plan}` : status ? `${status.toLowerCase()} (${plan})` : plan;
    const remarks = String(r.remarks || "").trim();
    const unit = String(r.unit || "").trim();
    const text = [`${type || "Strefa"} ${designator}`, `${lower ?? "?"} – ${upper ?? "?"}`, unit && `jednostka ${unit}`, remarks && `uwagi: ${remarks}`, `PAŻP ${plan}`]
      .filter(Boolean)
      .join(" · ");
    out.push({
      id: `${designator} ${new Date(from).toISOString().slice(5, 16)}–${new Date(to).toISOString().slice(11, 16)}`.slice(0, 80),
      location: "EPWW",
      type: "N",
      replaces: null,
      qcode: null,
      category,
      label: `${label} · ${designator}`,
      condition: plan,
      condition_label: statusLabel,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      permanent: false,
      estimated: false,
      schedule: null,
      lower,
      upper,
      text: text.slice(0, 600),
      raw: "", // no ICAO text: the reservation line above is the whole message
      center,
      radius_nm: null,
      geometry,
      geometry_source: "aup",
      bbox: bboxOf(pts),
      voivodeships,
      map: MAP_CATS.has(category),
      source: "aup",
    });
  }
  return out;
}

/** Features of one or more plans → de-duplicated items (the same reservation appears in AUP and UUP). */
export function itemsFromPlans(plans) {
  const byKey = new Map();
  for (const { features, plan } of plans) {
    for (const f of Array.isArray(features) ? features : []) {
      for (const it of aupItems(f, plan)) {
        const key = `${it.id}|${it.lower}|${it.upper}`;
        if (byKey.has(key)) continue;
        // Same area and times at other altitudes: keep it, under a distinct id (list keys must be unique).
        let id = it.id;
        for (let n = 2; [...byKey.values()].some((x) => x.id === id); n++) id = `${it.id} #${n}`;
        byKey.set(key, { ...it, id });
      }
    }
  }
  return [...byKey.values()];
}

export function aupState(it, now = Date.now()) {
  if (now < Date.parse(it.from)) return "upcoming";
  if (now >= Date.parse(it.to)) return "ended";
  return "active";
}

let snap = { enabled: AUP_ENABLED, ok: false, source: "PAŻP AUP/UUP (airspace.pansa.pl)", fetched_at: null, error: AUP_ENABLED ? "jeszcze nie pobrano" : "wyłączone", items: [] };
let fails = 0;
let started = false;
let cached = null;

async function getPlan(path) {
  const text = await fetchText(`${BASE}/${path}`, { timeout: 30_000, max: 8 * 1024 * 1024, headers: { Accept: "application/json" } });
  const d = JSON.parse(text);
  if (!Array.isArray(d)) throw new Error(`${path}: odpowiedź nie jest listą`);
  return d;
}

async function poll() {
  try {
    const current = await getPlan("map-configuration/uup");
    // The next day's AUP is published in the afternoon; before that the list is empty or missing.
    const next = await getPlan("map-configuration/nextAup").catch(() => []);
    const items = itemsFromPlans([
      { features: current, plan: "UUP" },
      { features: next, plan: "AUP na jutro" },
    ]);
    snap = { ...snap, ok: true, fetched_at: new Date().toISOString(), error: null, items };
    cached = null;
    fails = 0;
  } catch (err) {
    fails++;
    snap = { ...snap, ok: false, error: String(err.message || err).slice(0, 120) };
    cached = null;
  }
  setTimeout(() => void poll(), fails ? Math.min(EVERY_MS * 2 ** fails, MAX_BACKOFF_MS) : EVERY_MS).unref();
}

export function startAup() {
  if (!AUP_ENABLED || started) return;
  started = true;
  void poll();
}

/** Current/upcoming reservations with live state (ended ones drop out even while the source is down). */
export function aupSnapshot(now = Date.now()) {
  if (cached && now - cached.at < 60_000) return cached.value;
  const items = snap.items
    .map((it) => ({ ...it, state: aupState(it, now) }))
    .filter((it) => it.state !== "ended")
    .sort((a, b) => Number(b.map) - Number(a.map) || (a.state === b.state ? 0 : a.state === "active" ? -1 : 1) || a.from.localeCompare(b.from));
  const value = { ...snap, items };
  cached = { at: now, value };
  return value;
}

/** Row for /api/status (the "pazp" diode): informational layer, 0 points. */
export function aupStatusRow(now = Date.now()) {
  if (!AUP_ENABLED) return { id: "pazp", ok: true, age_s: 0, message: "AUP/UUP PAŻP wyłączone na tym serwerze", records: 0, diode: "off" };
  const at = snap.fetched_at ? Date.parse(snap.fetched_at) : 0;
  const ageS = at ? Math.round((now - at) / 1000) : 0;
  const n = aupSnapshot(now).items.length;
  const diode = !at ? "late" : ageS > 3 * 3600 ? "dead" : snap.ok && ageS <= 3600 ? "ok" : "late";
  return {
    id: "pazp",
    ok: !!at,
    age_s: ageS,
    message: at ? `AUP/UUP PAŻP · ${n} rezerwacji stref · warstwa informacyjna, 0 pkt` : `AUP/UUP PAŻP: ${snap.error || "brak danych"}`,
    records: n,
    diode,
  };
}

/**
 * The airspace layer's "notam" block: PAŻP AUP/UUP reservations first, then FAA NOTAMs (if that source works).
 * Same shape as notamSnapshot(), so the client needs no new code path.
 */
export function mergeAirspace(notam, aup) {
  const sources = [aup.enabled && aup.source, notam.enabled && notam.source].filter(Boolean);
  const errors = [aup.enabled && !aup.ok && `AUP: ${aup.error}`, notam.enabled && !notam.ok && `NOTAM: ${notam.error}`].filter(Boolean);
  const fetched = [aup.fetched_at, notam.fetched_at].filter(Boolean).sort().pop() ?? null;
  return {
    ...notam,
    enabled: !!(aup.enabled || notam.enabled),
    ok: !!((aup.enabled && aup.ok) || (notam.enabled && notam.ok)),
    source: sources.join(" + ") || notam.source,
    fetched_at: fetched,
    error: errors.length ? errors.join("; ") : null,
    total: (notam.total || 0) + (aup.enabled ? aup.items.length : 0),
    items: [...(aup.enabled ? aup.items : []), ...(notam.enabled ? notam.items : [])],
    aup: { enabled: aup.enabled, ok: aup.ok, fetched_at: aup.fetched_at, error: aup.error, count: aup.items.length, link: AUP_LINK },
  };
}
