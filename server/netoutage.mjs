/**
 * Internet outages for Poland and neighbours from IODA (Internet Outage Detection and Analysis,
 * Georgia Tech — https://ioda.inetintel.cc.gatech.edu, free, no key) and, optionally, Cloudflare Radar
 * outage annotations (CF_RADAR_TOKEN, free API token with Radar:Read; data CC BY-NC 4.0).
 * Polled every 10 min (min 5), last good snapshot kept in memory. ZORYA_NET_ENABLED=0 switches it off.
 */
const IODA = (process.env.IODA_BASE || "https://api.ioda.inetintel.cc.gatech.edu/v2").replace(/\/$/, "");
const UA = "zorya.website (+m@zorya.website)";
const off = /^(0|false|off|no)$/i.test(String(process.env.ZORYA_NET_ENABLED ?? "1").trim());
export const NET_ENABLED = !off;
const CF_TOKEN = (process.env.CF_RADAR_TOKEN || "").trim();
const POLL_MS = Math.max(5 * 60_000, Number(process.env.ZORYA_NET_POLL_MS) || 10 * 60_000);
const TIMEOUT_MS = 20_000;
const WINDOW_S = 24 * 3600;
const ACTIVE_S = 3 * 3600;

/** Country code -> [lat, lon, Polish name]. RU is shown at Kaliningrad (the part next to Poland). */
export const COUNTRIES = {
  PL: [52.1, 19.4, "Polska"],
  UA: [49.0, 31.4, "Ukraina"],
  BY: [53.7, 28.0, "Białoruś"],
  LT: [55.3, 23.9, "Litwa"],
  LV: [56.9, 24.6, "Łotwa"],
  EE: [58.7, 25.5, "Estonia"],
  RU: [54.7, 21.0, "Rosja (obw. królewiecki)"],
};

/** IODA region code -> map region id (public/geo) + centroid + Polish name. */
export const REGIONS = {
  4364: ["ua:cherkasy", 49.261, 31.359, "czerkaski"], 4355: ["ua:chernihiv", 51.362, 32.14, "czernihowski"],
  4357: ["ua:chernivtsi", 48.3, 26.198, "czerniowiecki"], 4353: ["ua:crimea", 45.305, 34.374, "Krym"],
  4371: ["ua:dnipropetrovsk", 48.287, 34.998, "dniepropetrowski"], 4372: ["ua:donetsk", 47.979, 37.559, "doniecki"],
  4358: ["ua:ivano-frankivsk", 48.667, 24.671, "iwanofrankiwski"], 4373: ["ua:kharkiv", 49.545, 36.467, "charkowski"],
  4378: ["ua:kherson", 46.471, 32.886, "chersoński"], 4359: ["ua:khmelnytskyi", 49.481, 26.954, "chmielnicki"],
  4377: ["ua:kyiv-city", 50.442, 30.517, "Kijów"], 4366: ["ua:kyiv", 50.315, 30.554, "kijowski"],
  4365: ["ua:kirovohrad", 48.475, 32.057, "kirowohradzki"], 4360: ["ua:lviv", 49.64, 23.79, "lwowski"],
  4374: ["ua:luhansk", 49.003, 39.005, "ługański"], 4354: ["ua:mykolaiv", 47.388, 31.793, "mikołajowski"],
  4367: ["ua:odesa", 46.493, 29.839, "odeski"], 4375: ["ua:poltava", 49.695, 33.823, "połtawski"],
  4356: ["ua:rivne", 51.011, 26.309, "rówieński"], 4379: ["ua:sevastopol", 44.578, 33.587, "Sewastopol"],
  4370: ["ua:sumy", 51.15, 34.14, "sumski"], 4361: ["ua:ternopil", 49.31, 25.705, "tarnopolski"],
  4362: ["ua:zakarpattia", 48.313, 23.187, "zakarpacki"], 4368: ["ua:vinnytsia", 48.938, 28.74, "winnicki"],
  4363: ["ua:volyn", 51.127, 24.52, "wołyński"], 4376: ["ua:zaporizhzhia", 47.017, 35.767, "zaporoski"],
  4369: ["ua:zhytomyr", 50.598, 28.518, "żytomierski"],
  3295: ["pl:slaskie", 50.282, 19.038, "śląskie"], 3302: ["pl:opolskie", 50.565, 17.854, "opolskie"],
  3293: ["pl:wielkopolskie", 52.348, 17.372, "wielkopolskie"], 3291: ["pl:zachodniopomorskie", 53.494, 15.691, "zachodniopomorskie"],
  3298: ["pl:swietokrzyskie", 50.786, 20.649, "świętokrzyskie"], 3294: ["pl:kujawsko-pomorskie", 53.042, 18.508, "kujawsko-pomorskie"],
  3299: ["pl:podlaskie", 53.325, 22.671, "podlaskie"], 3290: ["pl:dolnoslaskie", 51.032, 16.25, "dolnośląskie"],
  3301: ["pl:podkarpackie", 49.956, 22.206, "podkarpackie"], 3303: ["pl:malopolskie", 49.85, 20.277, "małopolskie"],
  3289: ["pl:pomorskie", 54.042, 18.096, "pomorskie"], 3288: ["pl:warminsko-mazurskie", 53.735, 20.767, "warmińsko-mazurskie"],
  3296: ["pl:lodzkie", 51.583, 19.408, "łódzkie"], 3297: ["pl:mazowieckie", 52.283, 21.135, "mazowieckie"],
  3300: ["pl:lubelskie", 51.248, 22.834, "lubelskie"], 3292: ["pl:lubuskie", 52.169, 15.459, "lubuskie"],
};

const SOURCE_PL = { bgp: "BGP (trasy)", "ping-slash24": "aktywne sondowanie", "merit-nt": "teleskop sieciowy", gtr: "ruch Google" };

let snap = {
  enabled: NET_ENABLED,
  ok: false,
  fetched_at: null,
  error: NET_ENABLED ? "jeszcze nie pobrano" : "wyłączone (ZORYA_NET_ENABLED=0)",
  window_h: WINDOW_S / 3600,
  items: [],
  signals: {},
  cloudflare: { enabled: !!CF_TOKEN, ok: null, error: null, items: [] },
  attribution: "IODA, Georgia Tech Internet Intelligence Lab",
};
let timer = null;
let fails = 0;

async function getJson(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** Severity from IODA overall score: IODA scores are unbounded, log scale is what their own UI uses. */
export function severity(score) {
  if (!Number.isFinite(score) || score <= 0) return 0;
  const l = Math.log10(score);
  return l >= 6 ? 3 : l >= 4 ? 2 : 1;
}

/** Location (scope, id, lat, lon, name) of an IODA entity we draw, or null if outside our area. */
export function locate(entity) {
  if (!entity) return null;
  if (entity.type === "country" && COUNTRIES[entity.code]) {
    const [lat, lon, name] = COUNTRIES[entity.code];
    return { scope: "country", id: `cc:${entity.code}`, country: entity.code, lat, lon, name };
  }
  if (entity.type === "region" && REGIONS[entity.code]) {
    const [id, lat, lon, name] = REGIONS[entity.code];
    return { scope: "region", id, country: id.slice(0, 2).toUpperCase(), lat, lon, name };
  }
  return null;
}

/** Merge IODA outage summaries and alerts into one list of map items (one per entity). */
export function buildItems(summaries, alerts, nowS) {
  const by = new Map();
  for (const s of summaries) {
    const loc = locate(s.entity);
    if (!loc) continue;
    const score = Number(s.scores?.overall) || 0;
    const sources = Object.keys(s.scores || {}).filter((k) => k !== "overall").map((k) => k.split(".")[0]);
    by.set(loc.id, { ...loc, score: Math.round(score), severity: severity(score), events: Number(s.event_cnt) || 0,
      sources: [...new Set(sources)], active: false, last_alert: null, alerts: [] });
  }
  for (const a of alerts) {
    const loc = locate(a.entity);
    if (!loc || (a.level !== "critical" && a.level !== "warning")) continue;
    let it = by.get(loc.id);
    if (!it) {
      it = { ...loc, score: 0, severity: 1, events: 0, sources: [], active: false, last_alert: null, alerts: [] };
      by.set(loc.id, it);
    }
    const t = Number(a.time) || 0;
    if (a.level === "critical" && nowS - t <= ACTIVE_S) it.active = true;
    if (!it.last_alert || t * 1000 > it.last_alert) it.last_alert = t * 1000;
    if (it.alerts.length < 10)
      it.alerts.push({ time: t * 1000, level: a.level, source: a.datasource, source_pl: SOURCE_PL[a.datasource] || a.datasource,
        value: a.value ?? null, expected: a.historyValue ?? null });
    if (a.datasource && !it.sources.includes(a.datasource)) it.sources.push(a.datasource);
  }
  for (const it of by.values()) {
    it.alerts.sort((x, y) => y.time - x.time);
    it.sources_pl = it.sources.map((s) => SOURCE_PL[s] || s);
    if (it.active) it.severity = Math.max(it.severity, 2);
  }
  return [...by.values()].sort((a, b) => Number(b.active) - Number(a.active) || b.score - a.score);
}

/** Compact signal series per datasource: [{source, step_s, from, values}] (values normalised 0..1 to max). */
export function compactSignals(d) {
  const out = [];
  for (const row of (d?.data || []).flat()) {
    if (!row || !Array.isArray(row.values) || !SOURCE_PL[row.datasource]) continue;
    const vals = row.values.map((v) => (Number.isFinite(v) ? v : null));
    const max = Math.max(0, ...vals.filter((v) => v != null));
    out.push({ source: row.datasource, source_pl: SOURCE_PL[row.datasource] || row.datasource, from: (row.from || 0) * 1000,
      step_s: row.step || null, values: vals.map((v) => (v == null || !max ? null : Math.round((v / max) * 1000) / 1000)) });
  }
  return out;
}

/** Cloudflare Radar outage annotations touching our countries. */
export function filterCf(annotations) {
  const want = new Set(Object.keys(COUNTRIES));
  return (annotations || [])
    .map((a) => ({ ...a, locs: (a.locations || []).map((l) => (typeof l === "string" ? l : l.code)).filter((c) => want.has(c)) }))
    .filter((a) => a.locs.length)
    .map((a) => ({ id: a.id, countries: a.locs, start: a.startDate || null, end: a.endDate || null,
      cause: a.outage?.outageCause || null, type: a.outage?.outageType || null,
      description: String(a.description || "").slice(0, 300), link: a.linkedUrl || null }));
}

async function pollCf() {
  if (!CF_TOKEN) return snap.cloudflare;
  try {
    const d = await getJson("https://api.cloudflare.com/client/v4/radar/annotations/outages?dateRange=7d&limit=100&format=json",
      { Authorization: `Bearer ${CF_TOKEN}` });
    return { enabled: true, ok: true, error: null, items: filterCf(d?.result?.annotations) };
  } catch (err) {
    return { ...snap.cloudflare, enabled: true, ok: false, error: String(err.message || err).slice(0, 120) };
  }
}

async function poll() {
  const nowS = Math.floor(Date.now() / 1000);
  const q = `from=${nowS - WINDOW_S}&until=${nowS}`;
  try {
    const [cs, ru, rp, al, alUa, alPl] = await Promise.all([
      getJson(`${IODA}/outages/summary?${q}&entityType=country`),
      getJson(`${IODA}/outages/summary?${q}&entityType=region&relatedTo=country/UA`),
      getJson(`${IODA}/outages/summary?${q}&entityType=region&relatedTo=country/PL`),
      getJson(`${IODA}/outages/alerts?${q}&entityType=country&limit=500`),
      getJson(`${IODA}/outages/alerts?${q}&entityType=region&relatedTo=country/UA&limit=500`),
      getJson(`${IODA}/outages/alerts?${q}&entityType=region&relatedTo=country/PL&limit=500`),
    ]);
    const items = buildItems([...(cs.data || []), ...(ru.data || []), ...(rp.data || [])],
      [...(al.data || []), ...(alUa.data || []), ...(alPl.data || [])], nowS);
    const signals = {};
    for (const cc of Object.keys(COUNTRIES)) {
      try {
        signals[cc] = compactSignals(await getJson(`${IODA}/signals/raw/country/${cc}?${q}&maxPoints=48`));
      } catch {
        signals[cc] = snap.signals[cc] || [];
      }
    }
    snap = { ...snap, ok: true, error: null, fetched_at: new Date().toISOString(), items, signals, cloudflare: await pollCf() };
    fails = 0;
  } catch (err) {
    fails += 1;
    snap = { ...snap, ok: false, error: String(err.name === "AbortError" ? "timeout" : err.message || err).slice(0, 120) };
    if (fails <= 3 || fails % 20 === 0) console.error(`IODA (#${fails})`, snap.error);
  }
  const delay = fails ? Math.min(60 * 60_000, POLL_MS * 2 ** Math.min(fails, 3)) : POLL_MS;
  timer = setTimeout(() => void poll(), delay);
  timer.unref?.();
}

export function startNetOutages() {
  if (!NET_ENABLED || timer) return;
  void poll();
}

export function netOutagesSnapshot() {
  return snap;
}
