/**
 * MAPA.UA — estimated positions of missiles, KAB bombs and drones over Ukraine (built from public
 * Telegram/monitoring messages, not radar). Polled at most every 30 s, last good snapshot kept in
 * memory, trimmed before it reaches the browser. MAPAUA_ENABLED=0 switches it off without a rebuild.
 */
const BASE = (process.env.MAPAUA_BASE || "https://mapa.ua").replace(/\/$/, "");
const UA = "zorya.website (+m@zorya.website)";
const off = /^(0|false|off|no)$/i.test(String(process.env.MAPAUA_ENABLED ?? "1").trim());
export const MAPAUA_ENABLED = !off;
const POLL_MS = Math.max(30_000, Number(process.env.MAPAUA_POLL_MS) || 30_000);
const COUNTRIES_MS = 5 * 60_000;
const CITIES_MS = 24 * 3600_000;
const TIMEOUT_MS = 15_000;
const MAX_BACKOFF_MS = 10 * 60_000;
const MAX_AGE_S = 60 * 60;
const TRAIL_MAX = 40;

const KINDS = new Set(["missile_cruise", "missile_ballistic", "bomb", "drone_jet", "drone_piston", "drone_fpv"]);

let snap = {
  enabled: MAPAUA_ENABLED,
  ok: false,
  fetched_at: null,
  source_ts: null,
  error: MAPAUA_ENABLED ? "jeszcze nie pobrano" : "wyłączone (MAPAUA_ENABLED=0)",
  attack: null,
  objects: [],
  pl_violations: null,
};
let rawObjects = [];
let cities = null;
let citiesAt = 0;
let fails = 0;
let timer = null;
let countriesAt = 0;

async function getJson(pathname) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}${pathname}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function refreshCities(now) {
  if (cities && now - citiesAt < CITIES_MS) return;
  try {
    const d = await getJson("/api/v1/geo/cities");
    if (d && typeof d.cities === "object") {
      const m = new Map();
      for (const [code, v] of Object.entries(d.cities)) {
        const name = (v && (v.en || v.ua)) || "";
        if (name && name !== code) m.set(code, name);
      }
      cities = m;
      citiesAt = now;
    }
  } catch (err) {
    // Keep the old dictionary; retry in an hour rather than every cycle.
    citiesAt = now - CITIES_MS + 3600_000;
    console.error("MAPA.UA cities", err.message || err);
  }
}

function placeName(code) {
  if (!code) return null;
  const c = String(code);
  return cities?.get(c) || cities?.get(c.replace(/\(.*\)$/, "")) || c;
}

const r5 = (x) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 1e5) / 1e5 : null);
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);

export function trimObjects(objects, nowS) {
  const out = [];
  for (const o of objects || []) {
    if (!o || r5(o.lat) == null || r5(o.lon) == null) continue;
    const last = num(o.last_seen);
    if (last == null || nowS - last > MAX_AGE_S) continue;
    const kind = KINDS.has(o.kind) ? o.kind : String(o.kind || "unknown");
    const trail = (Array.isArray(o.trail) ? o.trail : [])
      .slice(-TRAIL_MAX)
      .map((p) => [r5(p?.[0]), r5(p?.[1])])
      .filter((p) => p[0] != null && p[1] != null);
    const plat = r5(o.predicted_lat);
    const plon = r5(o.predicted_lon);
    const predicted =
      plat != null && plon != null && (plat !== r5(o.lat) || plon !== r5(o.lon)) ? [plon, plat] : null;
    out.push({
      id: String(o.id),
      kind,
      subkind: o.subkind ? String(o.subkind) : null,
      amount: num(o.amount) ?? 1,
      title: o.title ? String(o.title).slice(0, 300) : "",
      status: String(o.status || ""),
      heading: num(o.heading),
      speed_kmh: num(o.speed_kmh),
      lat: r5(o.lat),
      lon: r5(o.lon),
      predicted,
      trail,
      first_seen: num(o.first_seen) != null ? o.first_seen * 1000 : null,
      last_seen: last * 1000,
      from_zone: o.from_zone || null,
      from_name: placeName(o.from_zone),
      to_city: o.to_city || null,
      to_name: placeName(o.to_city),
    });
  }
  return out;
}

async function refreshCountries(now) {
  if (now - countriesAt < COUNTRIES_MS) return;
  countriesAt = now;
  try {
    const d = await getJson("/api/v1/countries?hours=12&detail=1");
    const pl = Number(d?.counts?.PL);
    if (Number.isFinite(pl)) {
      snap.pl_violations = {
        count: pl,
        hours: Number(d?.window?.hours) || 12,
        checked_at: new Date(now).toISOString(),
      };
    }
  } catch (err) {
    console.error("MAPA.UA countries", err.message || err);
  }
}

async function poll() {
  const now = Date.now();
  try {
    await refreshCities(now);
    const d = await getJson("/api/v1/current");
    if (!d || !Array.isArray(d.objects)) throw new Error("bad payload");
    rawObjects = d.objects;
    const a = d.attack;
    snap = {
      ...snap,
      ok: true,
      error: null,
      fetched_at: new Date(now).toISOString(),
      source_ts: num(d.ts) != null ? new Date(d.ts * 1000).toISOString() : null,
      attack: a ? { id: a.id, status: a.status, started_at: num(a.started_at) != null ? a.started_at * 1000 : null } : null,
      objects: trimObjects(rawObjects, Math.floor(now / 1000)),
    };
    fails = 0;
    await refreshCountries(now);
  } catch (err) {
    fails += 1;
    // Last good objects stay, but drop anything that has aged past 60 min since.
    snap = {
      ...snap,
      ok: false,
      error: String(err.name === "AbortError" ? "timeout" : err.message || err).slice(0, 120),
      objects: trimObjects(rawObjects, Math.floor(now / 1000)),
    };
    if (fails <= 3 || fails % 20 === 0) console.error(`MAPA.UA current (#${fails})`, snap.error);
  }
  const delay = fails ? Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** Math.min(fails, 5)) : POLL_MS;
  timer = setTimeout(() => void poll(), delay);
  timer.unref?.();
}

export function startMapaUa() {
  if (!MAPAUA_ENABLED || timer) return;
  void poll();
}

export function mapaUaSnapshot() {
  if (!MAPAUA_ENABLED) return snap;
  // Age filter at read time too, so a stalled feed never shows hour-old missiles as live.
  return { ...snap, objects: snap.objects.filter((o) => Date.now() - o.last_seen <= MAX_AGE_S * 1000) };
}
