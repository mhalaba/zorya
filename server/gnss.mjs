/**
 * GNSS (GPS) interference over Poland, the Baltic, Kaliningrad, Belarus and western Ukraine, on an
 * H3 resolution-4 grid — the method of gpsjam.org: share of aircraft whose ADS-B position quality
 * (NIC / NACp) is degraded.
 *  - daily: gpsjam.org daily file (yesterday, data from ADS-B Exchange), refreshed every 6 h;
 *  - live: own aggregation from open ADS-B APIs (adsb.lol, ODbL; adsb.fi as fallback). One request
 *    every ZORYA_GNSS_LIVE_MS (min 15 s) round-robin over a few fixed points, 45-minute window.
 * ZORYA_GNSS_ENABLED=0 switches everything off, ZORYA_GNSS_LIVE=0 only the live part.
 */
import { cellToBoundary, cellToLatLng, latLngToCell } from "h3-js";

const UA = "zorya.website (+m@zorya.website)";
const isOff = (v, d) => /^(0|false|off|no)$/i.test(String(v ?? d).trim());
export const GNSS_ENABLED = !isOff(process.env.ZORYA_GNSS_ENABLED, "1");
export const GNSS_LIVE = GNSS_ENABLED && !isOff(process.env.ZORYA_GNSS_LIVE, "1");
const LIVE_MS = Math.max(15_000, Number(process.env.ZORYA_GNSS_LIVE_MS) || 20_000);
const DAILY_MS = 6 * 3600_000;
const WINDOW_MS = 45 * 60_000;
const TIMEOUT_MS = 20_000;
const RES = 4;
/** Area of interest. */
export const BBOX = { minLat: 46, maxLat: 61, minLon: 12, maxLon: 34 };
/** Query points (lat, lon) with 250 NM radius: PL centre, S Baltic, Kaliningrad/Lithuania, Latvia/Estonia, Belarus, W Ukraine. */
const POINTS = [[52.2, 19.4], [55.2, 15.5], [54.8, 21.5], [57.8, 24.5], [53.6, 27.8], [49.6, 25.5]];
const PROVIDERS = [
  { name: "adsb.lol", url: (la, lo) => `https://api.adsb.lol/v2/point/${la}/${lo}/250`, list: (d) => d.ac },
  { name: "adsb.fi", url: (la, lo) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/250`, list: (d) => d.aircraft || d.ac },
];
export const MIN_AIRCRAFT = 3;

const inBox = (lat, lon) => lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLon && lon <= BBOX.maxLon;

/** Aircraft position quality: true = degraded (likely jamming/spoofing), false = good, null = can't tell. */
export function classify(ac) {
  if (!ac || typeof ac.lat !== "number" || typeof ac.lon !== "number") return null;
  if (ac.type && !String(ac.type).startsWith("adsb")) return null; // MLAT/TIS-B/ADS-C have no NIC/NACp meaning
  if (ac.alt_baro === "ground") return null;
  const nic = Number.isFinite(ac.nic) ? ac.nic : null;
  const nacp = Number.isFinite(ac.nac_p) ? ac.nac_p : null;
  if (nic == null && nacp == null) return null;
  return (nacp != null && nacp < 8) || (nic != null && nic < 7);
}

/** gpsjam-style degradation level from bad share. 0 none, 1 low (2–10 %), 2 high (>10 %). */
export function level(bad, good) {
  const n = bad + good;
  if (n < MIN_AIRCRAFT) return 0;
  const p = bad / n;
  return p > 0.1 ? 2 : p > 0.02 ? 1 : 0;
}

function cellFeature(h3, bad, good, source, extra = {}) {
  const ring = cellToBoundary(h3, true);
  ring.push(ring[0]);
  const n = bad + good;
  return {
    type: "Feature",
    id: `${source}:${h3}`,
    properties: { h3, source, bad, good, total: n, pct: n ? Math.round((bad / n) * 1000) / 10 : 0, level: level(bad, good), ...extra },
    geometry: { type: "Polygon", coordinates: [ring.map(([lo, la]) => [Math.round(lo * 1e4) / 1e4, Math.round(la * 1e4) / 1e4])] },
  };
}

/** Parse a gpsjam daily CSV (hex,count_good_aircraft,count_bad_aircraft), keep cells in BBOX with level>0. */
export function parseDaily(csv, date) {
  const out = [];
  for (const line of String(csv).split(/\r?\n/)) {
    const [h, g, b] = line.split(",");
    if (!h || h === "hex") continue;
    const good = Number(g), bad = Number(b);
    if (!Number.isFinite(good) || !Number.isFinite(bad) || level(bad, good) === 0) continue;
    let ll;
    try {
      ll = cellToLatLng(h);
    } catch {
      continue;
    }
    if (!inBox(ll[0], ll[1])) continue;
    out.push(cellFeature(h, bad, good, "daily", { date }));
  }
  return out;
}

/** Rolling live window: Map aircraftHex -> {cell, bad, t}; aggregated per cell on read. */
export class LiveAgg {
  constructor(windowMs = WINDOW_MS) {
    this.windowMs = windowMs;
    this.seen = new Map();
  }
  add(list, now) {
    let used = 0;
    for (const ac of list || []) {
      const bad = classify(ac);
      if (bad == null || !inBox(ac.lat, ac.lon) || !ac.hex) continue;
      const cell = latLngToCell(ac.lat, ac.lon, RES);
      // An aircraft counts once per cell per window; a bad sample sticks for the window (like gpsjam's daily max).
      const key = `${ac.hex}|${cell}`;
      const p2 = this.seen.get(key);
      this.seen.set(key, { cell, bad: bad || (p2?.bad ?? false), t: now });
      used++;
    }
    return used;
  }
  prune(now) {
    for (const [k, v] of this.seen) if (now - v.t > this.windowMs) this.seen.delete(k);
  }
  cells(now) {
    this.prune(now);
    const by = new Map();
    for (const v of this.seen.values()) {
      const c = by.get(v.cell) || { bad: 0, good: 0 };
      v.bad ? c.bad++ : c.good++;
      by.set(v.cell, c);
    }
    return by;
  }
  features(now) {
    const out = [];
    for (const [h3, c] of this.cells(now)) if (level(c.bad, c.good) > 0) out.push(cellFeature(h3, c.bad, c.good, "live"));
    return out;
  }
  stats(now) {
    const cells = this.cells(now);
    let ac = 0;
    for (const c of cells.values()) ac += c.bad + c.good;
    return { cells: cells.size, samples: ac };
  }
}

const live = new LiveAgg();
let snap = {
  enabled: GNSS_ENABLED,
  daily: { ok: false, date: null, fetched_at: null, error: GNSS_ENABLED ? "jeszcze nie pobrano" : "wyłączone", features: [] },
  live: { enabled: GNSS_LIVE, ok: false, updated_at: null, error: GNSS_LIVE ? "zbieram dane" : "wyłączone (ZORYA_GNSS_LIVE=0)",
    provider: null, window_min: WINDOW_MS / 60_000, cells: 0, samples: 0 },
  method: "Odsetek samolotów z obniżoną jakością pozycji ADS-B (NACp < 8 lub NIC < 7) w heksagonach H3 (rozdz. 4).",
  attribution: ["gpsjam.org (dane ADS-B Exchange)", "adsb.lol (ODbL)", "adsb.fi"],
};
let dailyTimer = null, liveTimer = null, idx = 0, liveFails = 0;

async function fetchText(url, accept = "*/*") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

const ymd = (d) => d.toISOString().slice(0, 10);

async function pollDaily() {
  const errs = [];
  for (const back of [1, 2, 3]) {
    const date = ymd(new Date(Date.now() - back * 86400_000));
    try {
      const csv = await fetchText(`https://gpsjam.org/data/${date}-h3_${RES}.csv`, "text/csv");
      const features = parseDaily(csv, date);
      snap = { ...snap, daily: { ok: true, date, fetched_at: new Date().toISOString(), error: null, features } };
      errs.length = 0;
      break;
    } catch (err) {
      errs.push(`${date}: ${err.message || err}`);
    }
  }
  if (errs.length) snap = { ...snap, daily: { ...snap.daily, ok: false, error: errs.join("; ").slice(0, 160) } };
  dailyTimer = setTimeout(() => void pollDaily(), DAILY_MS);
  dailyTimer.unref?.();
}

async function pollLive() {
  const [la, lo] = POINTS[idx % POINTS.length];
  idx++;
  const now = Date.now();
  let done = false, lastErr = null;
  for (const p of PROVIDERS) {
    try {
      const d = JSON.parse(await fetchText(p.url(la, lo), "application/json"));
      live.add(p.list(d), now);
      const st = live.stats(now);
      snap = { ...snap, live: { ...snap.live, ok: true, error: null, provider: p.name, updated_at: new Date(now).toISOString(), ...st } };
      done = true;
      break;
    } catch (err) {
      lastErr = String(err.message || err).slice(0, 100);
    }
  }
  if (done) liveFails = 0;
  else {
    liveFails++;
    snap = { ...snap, live: { ...snap.live, ok: false, error: lastErr } };
    if (liveFails <= 3 || liveFails % 50 === 0) console.error(`GNSS live (#${liveFails})`, lastErr);
  }
  const delay = liveFails ? Math.min(15 * 60_000, LIVE_MS * 2 ** Math.min(liveFails, 5)) : LIVE_MS;
  liveTimer = setTimeout(() => void pollLive(), delay);
  liveTimer.unref?.();
}

export function startGnss() {
  if (!GNSS_ENABLED || dailyTimer) return;
  void pollDaily();
  if (GNSS_LIVE) void pollLive();
}

export function gnssSnapshot() {
  const now = Date.now();
  const liveFeatures = GNSS_LIVE ? live.features(now) : [];
  return {
    ...snap,
    generated_at: new Date(now).toISOString(),
    features: { type: "FeatureCollection", features: [...snap.daily.features, ...liveFeatures] },
    daily: { ...snap.daily, features: undefined, cells: snap.daily.features.length },
    live: { ...snap.live, hot_cells: liveFeatures.length },
  };
}
