/**
 * Grid operators' public outage lists (JSON behind their own websites), as local alerts (category "power"):
 * - TAURON Dystrybucja: /waapi/outages/items — every planned and unplanned outage in Tauron's area
 *   (śląskie incl. Zabrze, małopolskie, opolskie, dolnośląskie, parts of podkarpackie, świętokrzyskie, łódzkie).
 * - PGE Dystrybucja: power-outage.gkpge.pl/api/power-outage — the list behind pgedystrybucja.pl/wylaczenia.
 * Each run replaces the source's items (revoked/withdrawn outages disappear). Planned works are published a week
 * ahead; only the next OPERATOR_HORIZON_MS (ZORYA_OPERATOR_HORIZON_H, default 72 h) is kept, to keep the payload sane.
 * Informational only: never changes the air-threat level.
 */
import { voivodeshipAt } from "./fusion.mjs";
import { mergeUnits, unitsForPoints, unitsFromTeryt, unitsFromText } from "./admin.mjs";
import { localStore, OPERATOR_HORIZON_MS, VOIV_IDS } from "./local.mjs";
import { envFlag, fetchText, parseWarsawTime, voivFromTeryt, voivFromText } from "./util.mjs";

const H = 3600_000;
const SUMMARY_MAX = 300;

const TAURON_URL = process.env.ZORYA_TAURON_URL || "https://www.tauron-dystrybucja.pl/waapi/outages/items";
const TAURON_LINK = "https://www.tauron-dystrybucja.pl/wylaczenia";
const PGE_URL = process.env.ZORYA_PGE_URL || "https://power-outage.gkpge.pl/api/power-outage";
const PGE_LINK_PLANNED = "https://pgedystrybucja.pl/wylaczenia/planowane-wylaczenia";
const PGE_LINK_NOW = "https://pgedystrybucja.pl/wylaczenia/aktualne-przerwy-w-dostawie-energii";

const iso = (ms) => new Date(ms).toISOString();
const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").replace(/(?:,\s*){2,}/g, ", ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/**
 * Place name from an outage message: "Jastrzębie-Zdrój: Norwida …" / "W miejscowości Jaczowice, posesje …" /
 * "Prószków ul. Osiedle 5B" / "Wierzchowiny - od numeru 68" → the town; otherwise the first words.
 */
export function placeOf(message) {
  const m = String(message || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:w\s+)?miejscowo\p{L}*\s+/iu, "");
  const head = m
    .split(/[:;,(]|\s[-–]\s?|\s(?:ul\.|ulica|ulice|al\.|aleja|os\.|osiedle|pl\.|stacja|stacje|posesj\p{L}*|dz\.|działk\p{L}*|nr|od|do|w kierunku|kierunek|pozbawion\p{L}*|obręb|gmina|gm\.)(?=\s|$)|\s\d/iu)[0]
    .trim();
  if (head && head.length <= 48) return head;
  return clip(m, 48);
}

/** [lon, lat] rounded to ~1 m, or null. */
const pointOf = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) ? [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] : null;

function baseItem({ id, source, source_name, kind, title, summary, url, published, start, end, voivodeships, units, point }) {
  return {
    id: String(id).slice(0, 120),
    source,
    source_name,
    categories: ["power"],
    category: "power",
    kind,
    title: clip(title, 160),
    summary: clip(summary, SUMMARY_MAX),
    url,
    published_at: iso(published || start),
    starts_at: iso(start),
    ends_at: iso(end),
    window: "source",
    voivodeships: voivodeships.filter((v) => VOIV_IDS.has(v)),
    gminy: units?.gminy ?? [],
    powiaty: units?.powiaty ?? [],
    point: point ?? null,
  };
}

const keep = (start, end, now) => Number.isFinite(start) && Number.isFinite(end) && end > now && start <= now + OPERATOR_HORIZON_MS;

// ---- TAURON ------------------------------------------------------------------------------------------

/** Tauron WAAPI row → local alert (TypeId 1 = planned, 2 = failure), or null (ended, too far ahead, unreadable). */
export function tauronItem(r, now = Date.now()) {
  if (!r || !r.OutageId || r.IsActive === false) return null;
  const start = Date.parse(r.StartDate);
  const end = Date.parse(r.EndDate);
  if (!keep(start, end, now)) return null;
  const kind = r.TypeId === 1 ? "planned" : "outage";
  const msg = String(r.Message || "");
  const pt = r.Center || (Array.isArray(r.Coordinates) ? r.Coordinates[0] : null);
  const at = pt ? voivodeshipAt(Number(pt.lat), Number(pt.lng)) : null;
  const point = pt ? pointOf(Number(pt.lat), Number(pt.lng)) : null;
  // Every vertex of the outage area (Coordinates) counts, so an outage spanning a gmina border lists both.
  const pts = (Array.isArray(r.Coordinates) ? r.Coordinates : []).map((c) => [Number(c?.lng), Number(c?.lat)]);
  const units = unitsForPoints(point ? [point, ...pts] : pts);
  return baseItem({
    id: `tauron-${r.OutageId}`,
    source: "tauron",
    source_name: "TAURON Dystrybucja",
    kind,
    title: `${kind === "planned" ? "Planowane wyłączenie prądu" : "Awaria — przerwa w dostawie prądu"}: ${placeOf(msg) || "obszar Tauron"}`,
    summary: msg,
    url: TAURON_LINK,
    published: Date.parse(r.Modified) || start,
    start,
    end,
    voivodeships: at ? [at] : voivFromText(msg),
    units: units.gminy.length ? units : unitsFromText(msg, at ? [at] : []),
    point,
  });
}

/** One item per OutageId: the API lists an outage once per area it touches (union of voivodeships). */
export function tauronItems(rows, now = Date.now()) {
  const byId = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const it = tauronItem(r, now);
    if (!it) continue;
    const prev = byId.get(it.id);
    if (!prev) byId.set(it.id, it);
    else {
      for (const v of it.voivodeships) if (!prev.voivodeships.includes(v)) prev.voivodeships.push(v);
      Object.assign(prev, mergeUnits(prev, it));
    }
  }
  return [...byId.values()];
}

/** Every outage in Tauron's area from now to the horizon: one request (the site's own map uses it). */
export function tauronUrl(now = Date.now()) {
  const u = new URL(TAURON_URL);
  u.searchParams.set("fromDate", iso(now));
  u.searchParams.set("toDate", iso(now + OPERATOR_HORIZON_MS));
  return u.toString();
}

// ---- PGE ---------------------------------------------------------------------------------------------

/** PGE row → local alert (type 1 = current failure, 2 = planned), or null (revoked, ended, too far ahead). */
export function pgeItem(r, now = Date.now()) {
  if (!r || r.revoked === true || r.deleted === true) return null;
  const ranges = Array.isArray(r.dateRanges) && r.dateRanges.length ? r.dateRanges : [{ startAt: r.startAt, stopAt: r.stopAt }];
  const starts = ranges.map((x) => parseWarsawTime(x.startAt)).filter(Boolean);
  const ends = ranges.map((x) => parseWarsawTime(x.stopAt)).filter(Boolean);
  if (!starts.length || !ends.length) return null;
  // Several ranges: the soonest one that has not ended yet decides the window shown.
  const live = ranges
    .map((x) => ({ s: parseWarsawTime(x.startAt), e: parseWarsawTime(x.stopAt) }))
    .filter((x) => x.s && x.e && x.e > now)
    .sort((a, b) => a.s - b.s);
  const win = live[0] || { s: Math.min(...starts), e: Math.max(...ends) };
  if (!keep(win.s, win.e, now)) return null;
  const kind = r.type === 1 ? "outage" : "planned";
  const addr = Array.isArray(r.addresses) ? r.addresses : [];
  const teryt = addr.map((a) => a?.teryt?.voivodeshipCode || a?.teryt?.communeCode).filter(Boolean);
  let voiv = voivFromTeryt(teryt);
  const coords = (Array.isArray(r.coordinates) ? r.coordinates : []).map((c) => [Number(c?.longitude), Number(c?.latitude)]);
  if (!voiv.length && coords[0]) {
    const at = voivodeshipAt(coords[0][1], coords[0][0]);
    if (at) voiv = [at];
  }
  const desc = String(r.description || "");
  if (!voiv.length) voiv = voivFromText(desc);
  // Gmina from the address TERYT (communeCode) and from the outage coordinates; the text as a last resort.
  let units = mergeUnits(
    unitsFromTeryt(addr.flatMap((a) => [a?.teryt?.communeCode, a?.teryt?.districtCode, a?.teryt?.countyCode])),
    unitsForPoints(coords)
  );
  if (!units.gminy.length && !units.powiaty.length) units = unitsFromText(desc, voiv);
  const point = coords[0] ? pointOf(coords[0][1], coords[0][0]) : null;
  const place = addr[0]?.teryt?.cityName || placeOf(desc) || r.regionName || "obszar PGE";
  const more = live.length > 1 ? ` (+${live.length - 1} kolejne terminy)` : "";
  return baseItem({
    id: `pge-${r.uuid || r.id}`,
    source: "pge",
    source_name: `PGE Dystrybucja${r.regionName ? ` · RE ${r.regionName}` : ""}`,
    kind,
    title: `${kind === "planned" ? "Planowane wyłączenie prądu" : "Awaria — przerwa w dostawie prądu"}: ${place}`,
    summary: `${desc}${more}`,
    url: kind === "planned" ? PGE_LINK_PLANNED : PGE_LINK_NOW,
    published: parseWarsawTime(r.updatedAt) || parseWarsawTime(r.createdAt) || win.s,
    start: win.s,
    end: win.e,
    voivodeships: voiv,
    units,
    point,
  });
}

export function pgeItems(rows, now = Date.now()) {
  const list = Array.isArray(rows) ? rows : rows?.content || rows?.items || [];
  return list.map((r) => pgeItem(r, now)).filter(Boolean);
}

// ---- polling -----------------------------------------------------------------------------------------

/** JSON list from an operator; a non-JSON answer (they sometimes return an XML/HTML error page) is retried once. */
async function jsonList(url, opts) {
  for (let attempt = 0; ; attempt++) {
    const text = await fetchText(url, { ...opts, headers: { Accept: "application/json" } });
    const t = text.trimStart();
    if (t.startsWith("[") || t.startsWith("{")) return JSON.parse(t);
    if (attempt >= 1) throw new Error(`odpowiedź nie-JSON: ${t.slice(0, 60).replace(/\s+/g, " ")}`);
    await new Promise((r) => setTimeout(r, 20_000));
  }
}

const SOURCES = [
  {
    id: "tauron",
    name: "TAURON Dystrybucja (wyłączenia)",
    flag: "ZORYA_TAURON_ENABLED",
    every: 15 * 60_000,
    fetch: async (now) => tauronItems(await jsonList(tauronUrl(now), { timeout: 45_000 }), now),
  },
  {
    // ~3–4 MB, slow (30–60 s): read every 30 min with a long timeout.
    id: "pge",
    name: "PGE Dystrybucja (wyłączenia)",
    flag: "ZORYA_PGE_ENABLED",
    every: 30 * 60_000,
    fetch: async (now) => pgeItems(await jsonList(PGE_URL, { timeout: 150_000, max: 24 * 1024 * 1024 }), now),
  },
];

export function startOperators(store = localStore) {
  for (const src of SOURCES) {
    if (!envFlag(src.flag) || !envFlag("ZORYA_LOCAL_ENABLED")) continue;
    let fails = 0;
    const run = async () => {
      try {
        const now = Date.now();
        const items = await src.fetch(now);
        store.replaceSource(src.id, items, Date.now());
        store.setStatus(src.id, { name: src.name, ok: true, at: new Date().toISOString(), records: items.length, error: null });
        fails = 0;
      } catch (err) {
        fails++;
        // Keep the last good list; it still ages out by each outage's own end time.
        store.setStatus(src.id, { name: src.name, ok: false, at: new Date().toISOString(), records: 0, error: String(err.message || err).slice(0, 120) });
      }
      store.save();
      setTimeout(() => void run(), fails ? Math.min(src.every * 2 ** fails, 3 * H) : src.every).unref();
    };
    void run();
  }
}
