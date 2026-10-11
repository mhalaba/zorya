/**
 * IMGW-PIB warnings from the public API (danepubliczne.imgw.pl, read every 10 min):
 * - meteorological warnings (warningsmeteo): event, level 1–3, probability, window, powiats (TERYT) → voivodeships;
 * - hydrological warnings (warningshydro): rises of water levels (level 1–3) and hydrological drought (level -1),
 *   per voivodeship/catchment.
 * Published as local alerts with categories "meteo" / "hydro". Informational only: they never change the
 * air-threat level, never feed the RCB/RSO alarm and never trigger push or the SimpleX /polska alert.
 * The RSO parser skips IMGW re-posts (SKIP in local.mjs), so nothing is shown twice.
 */
import { localStore, VOIV_IDS } from "./local.mjs";
import { envFlag, fetchText, hash, parseWarsawTime, voivFromTeryt, voivFromText } from "./util.mjs";

const BASE = (process.env.ZORYA_IMGW_BASE || "https://danepubliczne.imgw.pl/api/data").replace(/\/$/, "");
const EVERY_MS = 10 * 60_000;
const DAY = 24 * 3600_000;
/** "do odwołania" (9999-12-31) is shown as an open window, re-extended on every read. */
const OPEN_END_MS = 30 * DAY;
const LINK_METEO = "https://meteo.imgw.pl/";
const LINK_HYDRO = "https://hydro.imgw.pl/";

const iso = (ms) => new Date(ms).toISOString();
const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const levelOf = (v) => {
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
};
/** End of window; "9999-…" (until cancelled) → now + OPEN_END_MS, flagged. */
function endOf(s, now) {
  // Rounded to a day, so the stored item does not change (and get rewritten) on every read.
  if (/^9999/.test(String(s || ""))) return { end: Math.ceil((now + OPEN_END_MS) / DAY) * DAY, open: true };
  return { end: parseWarsawTime(s), open: false };
}

export function levelLabel(level) {
  if (level === -1) return "ostrzeżenie o suszy";
  if (level >= 1 && level <= 3) return `${level}. stopień`;
  return "ostrzeżenie";
}

/** warningsmeteo row → local alert, or null (ended, unreadable). */
export function meteoItem(r, now = Date.now()) {
  if (!r || !r.nazwa_zdarzenia) return null;
  const start = parseWarsawTime(r.obowiazuje_od);
  const { end, open } = endOf(r.obowiazuje_do, now);
  if (!start || !end || end <= now) return null;
  const level = levelOf(r.stopien);
  const teryt = Array.isArray(r.teryt) ? r.teryt : [];
  const voiv = voivFromTeryt(teryt).filter((v) => VOIV_IDS.has(v));
  const prob = r.prawdopodobienstwo ? ` Prawdopodobieństwo ${r.prawdopodobienstwo}%.` : "";
  const comment = r.komentarz && !/^brak\.?$/i.test(String(r.komentarz).trim()) ? ` ${r.komentarz}` : "";
  return {
    id: `imgw-meteo-${String(r.id || hash(`${r.nazwa_zdarzenia}${r.opublikowano}${teryt.join()}`)).slice(0, 80)}`,
    source: "imgw-meteo",
    source_name: "IMGW-PIB · ostrzeżenia meteorologiczne",
    categories: ["meteo"],
    category: "meteo",
    kind: "warning",
    level,
    title: clip(`${r.nazwa_zdarzenia} — ${levelLabel(level)}`, 160),
    summary: clip(`${r.tresc || ""}${prob}${comment} Powiaty: ${teryt.length}.`, 500),
    url: LINK_METEO,
    published_at: iso(parseWarsawTime(r.opublikowano) || start),
    starts_at: iso(start),
    ends_at: iso(end),
    until_cancelled: open,
    window: "source",
    voivodeships: voiv,
  };
}

/** warningshydro row → local alert, or null. Drought ("Susza hydrologiczna", level -1) stays until cancelled. */
export function hydroItem(r, now = Date.now()) {
  const event = r?.zdarzenie;
  if (!event) return null;
  const level = levelOf(r["stopień"] ?? r.stopien);
  const start = parseWarsawTime(r.data_od) || parseWarsawTime(r.opublikowano);
  const { end, open } = endOf(r.data_do, now);
  if (!start || !end || end <= now) return null;
  const areas = Array.isArray(r.obszary) ? r.obszary : [];
  const voiv = [];
  for (const a of areas) for (const v of voivFromText(String(a?.wojewodztwo || ""))) if (VOIV_IDS.has(v) && !voiv.includes(v)) voiv.push(v);
  const where = [...new Set(areas.map((a) => String(a?.opis || "").replace(/^[^,]+,\s*/, "").replace(/,\s*[^,]*$/, "").trim()).filter(Boolean))];
  const prob = r.prawdopodobienstwo ? ` Prawdopodobieństwo ${r.prawdopodobienstwo}%.` : "";
  return {
    id: `imgw-hydro-${hash(`${r.biuro}|${r.numer}|${event}|${r.opublikowano}`)}`,
    source: "imgw-hydro",
    source_name: "IMGW-PIB · ostrzeżenia hydrologiczne",
    categories: ["hydro"],
    category: "hydro",
    kind: "warning",
    level,
    title: clip(`${event}${level === -1 ? "" : ` — ${levelLabel(level)}`}${r.numer ? ` (nr ${r.numer})` : ""}`, 160),
    summary: clip(`${where.length ? `${where.join("; ")}. ` : ""}${r.przebieg || ""}${prob}`, 500),
    url: LINK_HYDRO,
    published_at: iso(parseWarsawTime(r.opublikowano) || start),
    starts_at: iso(start),
    ends_at: iso(end),
    until_cancelled: open,
    window: "source",
    voivodeships: voiv,
  };
}

export const meteoItems = (rows, now = Date.now()) => (Array.isArray(rows) ? rows : []).map((r) => meteoItem(r, now)).filter(Boolean);
export const hydroItems = (rows, now = Date.now()) => (Array.isArray(rows) ? rows : []).map((r) => hydroItem(r, now)).filter(Boolean);

const FEEDS = [
  { id: "imgw-meteo", name: "IMGW-PIB ostrzeżenia meteorologiczne", path: "warningsmeteo", map: meteoItems },
  { id: "imgw-hydro", name: "IMGW-PIB ostrzeżenia hydrologiczne", path: "warningshydro", map: hydroItems },
];

export function startImgw(store = localStore) {
  if (!envFlag("ZORYA_IMGW_ENABLED") || !envFlag("ZORYA_LOCAL_ENABLED")) return;
  const run = async () => {
    for (const f of FEEDS) {
      try {
        const rows = JSON.parse(await fetchText(`${BASE}/${f.path}`, { timeout: 20_000, headers: { Accept: "application/json" } }));
        if (!Array.isArray(rows)) throw new Error("odpowiedź nie jest listą");
        const now = Date.now();
        const items = f.map(rows, now);
        store.replaceSource(f.id, items, now);
        store.setStatus(f.id, { name: f.name, ok: true, at: new Date(now).toISOString(), records: items.length, error: null });
      } catch (err) {
        store.setStatus(f.id, { name: f.name, ok: false, at: new Date().toISOString(), records: 0, error: String(err.message || err).slice(0, 120) });
      }
    }
    store.save();
  };
  void run();
  setInterval(() => void run(), EVERY_MS).unref();
}
