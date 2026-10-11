/**
 * Local alerts per voivodeship: water, power and gas outages (failures and planned works) and scheduled
 * exercises. Built-in source: RSO notices (komunikaty.tvp.pl), already fetched every minute by ingest.mjs.
 * Optional extra RSS/Atom feeds (grid operators, waterworks, municipal BIPs) via ZORYA_LOCAL_FEEDS.
 * Informational only: local alerts never change the air-threat level of a voivodeship.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeHttpUrl } from "./security.mjs";
import { envFlag, getText, parseFeed, voivFromText, warsawDate, warsawToUtc } from "./util.mjs";

/** meteo / hydro: IMGW warnings (server/imgw.mjs). */
export const LOCAL_CATEGORIES = ["power", "water", "gas", "exercise", "meteo", "hydro"];
export const VOIV_IDS = new Set([
  "dolnoslaskie", "kujawsko-pomorskie", "lubelskie", "lubuskie", "lodzkie", "malopolskie", "mazowieckie", "opolskie",
  "podkarpackie", "podlaskie", "pomorskie", "slaskie", "swietokrzyskie", "warminsko-mazurskie", "wielkopolskie", "zachodniopomorskie",
]);

const H = 3600_000;
const DAY = 24 * H;
/** How long a notice without a readable date stays on the map, counted from its last update. */
const DEFAULT_TTL = { outage: 24 * H, planned: 3 * DAY, exercise: 3 * DAY };
/** Ended items linger briefly ("zakończone"), then go. Nothing older than this is kept at all. */
const LINGER_MS = 2 * H;
const MAX_AGE_MS = 21 * DAY;
const MAX_ITEMS = 4000;
/** Operator outage lists (Tauron, PGE, Energa feeds) run a week ahead; only this much is published. */
export const OPERATOR_HORIZON_MS = Math.max(6, Number(process.env.ZORYA_OPERATOR_HORIZON_H) || 72) * H;
/** Items per RSS/Atom feed read (Energa's planned-outage feeds carry 40–140). */
const FEED_ITEM_LIMIT = Math.max(25, Number(process.env.ZORYA_FEED_ITEM_LIMIT) || 250);

// ---- classification -------------------------------------------------------------------------------

const W = "(?:\\p{L}+[\\s,]+){0,3}"; // up to three filler words ("przerwa w dostawie energii")

/** Forecasts and weather/flood warnings mention "possible outages" — they are not outage notices. */
const SKIP = new RegExp(
  [
    "ostrzeżeni\\p{L}*\\s+(?:meteorologiczn|hydrologiczn)",
    "\\bimgw\\b",
    "jakoś\\p{L}*\\s+powietrza",
    "kąpielisk",
  ].join("|"),
  "iu"
);

const RX = {
  exercise: new RegExp(
    [
      // (?!\\p{L}) pins the whole word, so the "fizyczn" look-ahead cannot be dodged by backtracking.
      "(?<!\\p{L})[ćc]wicze\\p{L}*(?!\\p{L})(?!\\s+fizyczn)",
      `test\\p{L}*\\s+${W}syren`,
      `próbn\\p{L}*\\s+${W}alarm`,
      `trening\\p{L}*\\s+${W}(?:służb|ratownicz|obron|wojsk)`,
      "(?<!\\p{L})manewr\\p{L}*",
      "strzela\\p{L}*\\s+(?:na\\s+)?poligon",
      "zajęci\\p{L}*\\s+(?:na\\s+)?poligon",
    ].join("|"),
    "iu"
  ),
  power: new RegExp(
    [
      `(?:przerw|wyłącze|wyłącza|brak|awari|ogranicze|wstrzyma)\\p{L}*\\s+${W}(?:energii|prądu|zasilania|napięcia)`,
      `(?:bez|pozbawi\\p{L}*)\\s+${W}(?:prądu|zasilania|energii\\s+elektrycznej)`,
      "awari\\p{L}*\\s+(?:\\p{L}+\\s+){0,2}(?:energetyczn|sieci\\s+elektro)",
      "(?:pge|tauron|enea|energa|stoen)[\\s-]+(?:dystrybucja|operator)",
    ].join("|"),
    "iu"
  ),
  water: new RegExp(
    [
      "przydatno\\p{L}*\\s+wody",
      "(?:nie)?przydatn\\p{L}*\\s+(?:\\p{L}+\\s+){0,2}do\\s+spożycia",
      "wod\\p{L}*\\s+(?:nie\\s*)?przydatn",
      "wody\\s+(?:do\\s+spożycia|pitnej|wodociągow)",
      "(?<!\\p{L})wodociąg",
      `(?:przerw|wyłącze|wstrzyma|brak|ogranicze)\\p{L}*\\s+${W}(?:dostaw\\p{L}*\\s+)?wody`,
      "dostaw\\p{L}*\\s+wody",
      "beczkowo\\p{L}*",
      "ujęci\\p{L}*\\s+wody",
      "stacj\\p{L}*\\s+uzdatniania",
      "bakteri\\p{L}*\\s+(?:\\p{L}+\\s+){0,2}coli",
    ].join("|"),
    "iu"
  ),
  gas: new RegExp(
    [
      `(?:przerw|wyłącze|wstrzyma|brak|ogranicze|awari)\\p{L}*\\s+${W}(?:dostaw\\p{L}*\\s+)?(?:gazu|paliwa\\s+gazowego)`,
      "(?:ulatnia|wyciek|rozszczelni)\\p{L}*\\s+(?:się\\s+)?gazu",
      "(?<!\\p{L})gazociąg",
      "sieci\\p{L}*\\s+gazow",
      "spółk\\p{L}*\\s+gazownictwa",
      "(?<!\\p{L})psg(?!\\p{L})",
    ].join("|"),
    "iu"
  ),
};

const PLANNED = new RegExp(
  [
    "(?<!nie)planowan\\p{L}*",
    "zaplanowan\\p{L}*",
    `prac\\p{L}*\\s+${W}(?:konserwac|moderniz|remont|eksploatac|sieci|planow|przyłącz|inwestyc)`,
    "harmonogram",
  ].join("|"),
  "iu"
);
const UNPLANNED = /nieplanowan|awari|uszkodze|zerwan|wichur|nawałnic|burz/iu;

/**
 * Category list (primary first) and kind for a notice, or null when it is none of ours.
 * The headline decides first; the body only when the headline says nothing.
 */
export function classifyLocal(title, body = "") {
  const head = String(title || "");
  const all = `${head} ${body}`;
  if (SKIP.test(all)) return null;
  const order = ["exercise", "power", "water", "gas"];
  let cats = order.filter((c) => RX[c].test(head));
  if (!cats.length) {
    cats = order
      .map((c) => ({ c, i: all.search(RX[c]) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.c);
  } else {
    for (const c of order) if (!cats.includes(c) && RX[c].test(body)) cats.push(c);
  }
  if (!cats.length) return null;
  return { categories: cats, kind: kindFor(cats, head, all) };
}

function kindFor(cats, head, all) {
  if (cats[0] === "exercise") return "exercise";
  return PLANNED.test(all) && !UNPLANNED.test(head) ? "planned" : "outage";
}

// ---- time window from Polish text ----------------------------------------------------------------

const MONTHS = [
  ["stycz", 1], ["lut", 2], ["mar", 3], ["kwie", 4], ["maj", 5], ["czerw", 6],
  ["lip", 7], ["sierp", 8], ["wrze", 9], ["paźdz", 10], ["pazdz", 10], ["listop", 11], ["grud", 12],
];
const MONTH_RX =
  "(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|wrzesnia|października|pazdziernika|listopada|grudnia)";

function monthOf(word) {
  const w = word.toLowerCase();
  return MONTHS.find(([stem]) => w.startsWith(stem))?.[1] ?? 0;
}

/**
 * Finds dates and clock times in a notice and turns them into a [start, end) window (epoch ms, Warsaw time).
 * "w dniu 15.10.2026 w godz. 8:00–14:00", "14-15 października", "od 12 do 16 października", "od 8.00 do 15.30", "2026-10-15".
 * Returns null when nothing usable is found (the caller then applies a default lifetime).
 */
export function parsePlWindow(text, refTs = Date.now()) {
  let s = ` ${String(text || "")} `;
  const ref = warsawDate(refTs);
  const dates = []; // { at, y, mo, d }
  const mask = (m) => {
    s = s.slice(0, m.index) + " ".repeat(m[0].length) + s.slice(m.index + m[0].length);
  };
  const push = (at, y, mo, d) => {
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) dates.push({ at, y, mo, d });
  };
  const yearFor = (mo, d, y) => {
    if (y) return y;
    // No year: the nearest such date, not one 11 months in the past.
    const same = warsawToUtc(ref.y, mo, d);
    return same < refTs - 60 * DAY ? ref.y + 1 : ref.y;
  };
  const scan = (re, fn) => {
    for (const m of [...s.matchAll(re)]) {
      fn(m);
      mask(m);
    }
  };
  // Order matters: ranges and ISO dates first, so their parts are not re-read as single dates or times.
  scan(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => push(m.index, +m[1], +m[2], +m[3]));
  scan(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g, (m) => {
    push(m.index, +m[4], +m[3], +m[1]);
    push(m.index + 1, +m[4], +m[3], +m[2]);
  });
  scan(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g, (m) => push(m.index, +m[3], +m[2], +m[1]));
  scan(new RegExp(`\\b(\\d{1,2})(?:\\s*(?:[-–]|do)\\s*(\\d{1,2}))?\\s+${MONTH_RX}(?:\\s+(\\d{4}))?`, "giu"), (m) => {
    const mo = monthOf(m[3]);
    const y = yearFor(mo, +m[1], m[4] ? +m[4] : 0);
    push(m.index, y, mo, +m[1]);
    if (m[2]) push(m.index + 1, y, mo, +m[2]);
  });
  if (!dates.length) return null;

  const times = []; // minutes after midnight, in text order
  scan(/\b(?:godz(?:in(?:ach|ami|y|a)?)?\.?)\s*(\d{1,2})\s*(?:[-–]|do)\s*(\d{1,2})\b(?![:.]\d)/giu, (m) => {
    times.push({ at: m.index, min: +m[1] * 60 });
    times.push({ at: m.index + 1, min: +m[2] * 60 });
  });
  scan(/\b(\d{1,2})[:.](\d{2})\b/g, (m) => {
    if (+m[1] <= 24 && +m[2] <= 59) times.push({ at: m.index, min: Math.min(24 * 60, +m[1] * 60 + +m[2]) });
  });
  times.sort((a, b) => a.at - b.at);
  dates.sort((a, b) => a.at - b.at);

  // "Komunikat z dnia 10.10…: w dniu 15.10…" — the stamp of the notice itself is not the window.
  const refDay = warsawToUtc(ref.y, ref.mo, ref.d);
  const dayMs = (x) => warsawToUtc(x.y, x.mo, x.d);
  let useful = dates.filter((x) => dayMs(x) >= refDay - DAY);
  if (!useful.length) useful = dates;
  const first = useful.reduce((a, b) => (dayMs(b) < dayMs(a) ? b : a));
  const last = useful.reduce((a, b) => (dayMs(b) > dayMs(a) ? b : a));

  const at = (x, min) => warsawToUtc(x.y, x.mo, x.d, Math.floor(min / 60), min % 60);
  let start = at(first, times.length ? times[0].min : 0);
  let end = at(last, times.length >= 2 ? times[times.length - 1].min : 24 * 60 - 1);
  if (end <= start) end += DAY; // "22:00–6:00": overnight
  // Sanity: a window far in the past or future, or months long, is a misread — ignore it.
  if (start < refTs - 30 * DAY || start > refTs + 180 * DAY || end - start > 62 * DAY) return null;
  return { start, end };
}

// ---- items and store -----------------------------------------------------------------------------

/**
 * Turns parsed notices ({ id, title, summary, text, ts, url, voivodeships, source, source_name }) into
 * local alerts. Notices that are not about water/power/gas or exercises are dropped.
 */
export function toLocalItems(rows, now = Date.now(), fixedCategory = null) {
  const out = [];
  for (const r of rows || []) {
    if (!r?.ts || now - r.ts > MAX_AGE_MS) continue;
    const text = `${r.title || ""} ${r.summary || ""} ${r.text || ""}`;
    const cls = classifyLocal(`${r.title || ""} ${r.summary || ""}`, r.text || "");
    if (!cls && !fixedCategory) continue;
    const categories = fixedCategory ? [fixedCategory] : cls.categories;
    const head = `${r.title || ""} ${r.summary || ""}`;
    const win = parsePlWindow(text, r.ts);
    let kind = kindFor(categories, head, text);
    // Announced ahead of time (window starts later than the notice) and not called a failure: planned.
    if (kind === "outage" && win && win.start > r.ts + 3600_000 && !UNPLANNED.test(head)) kind = "planned";
    const start = win?.start ?? r.ts;
    const end = win?.end ?? r.ts + DEFAULT_TTL[kind];
    const voiv = (r.voivodeships?.length ? r.voivodeships : voivFromText(text)).filter((v) => VOIV_IDS.has(v));
    out.push({
      id: String(r.id).slice(0, 120),
      source: r.source || "rso",
      source_name: r.source_name || "RSO",
      categories,
      category: categories[0],
      kind,
      title: String(r.title || "").slice(0, 300),
      summary: String(r.summary || "").slice(0, 600),
      url: safeHttpUrl(r.url),
      published_at: new Date(r.ts).toISOString(),
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(end).toISOString(),
      window: win ? "text" : "default",
      voivodeships: voiv,
    });
  }
  return out;
}

export function itemState(it, now = Date.now()) {
  const s = Date.parse(it.starts_at);
  const e = Date.parse(it.ends_at);
  if (now < s) return "upcoming";
  if (now < e) return "active";
  return "ended";
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ZORYA_DATA_DIR || path.resolve(here, "..", "data");

export function createLocalStore({ file = null } = {}) {
  const items = new Map();
  let dirty = false;
  let snap = null;
  const status = new Map(); // source id → { at, err, records }

  const prune = (now) => {
    for (const [id, it] of items) {
      // Items with a window from the source live until it ends; only undated ones age out by publication.
      const stale = it.window === "default" && now - Date.parse(it.published_at) > MAX_AGE_MS;
      if (now - Date.parse(it.ends_at) > LINGER_MS || stale) {
        items.delete(id);
        dirty = true;
      }
    }
    if (items.size > MAX_ITEMS) {
      const oldest = [...items.values()].sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));
      for (const it of oldest.slice(0, items.size - MAX_ITEMS)) items.delete(it.id);
      dirty = true;
    }
  };

  const store = {
    /** Adds/updates items. RSO keeps notices that fell off its first page until their window ends. */
    merge(list, now = Date.now()) {
      let changed = false;
      for (const it of list || []) {
        const prev = items.get(it.id);
        if (prev && JSON.stringify(prev) === JSON.stringify(it)) continue;
        items.set(it.id, it);
        changed = true;
      }
      const before = items.size;
      prune(now);
      if (changed || items.size !== before) {
        dirty = true;
        snap = null;
      }
    },
    /**
     * Replaces everything from one source (operator APIs, IMGW): withdrawn or revoked entries disappear at once,
     * unlike RSO notices, which are kept after they scroll off the first page.
     */
    replaceSource(source, list, now = Date.now()) {
      const keep = new Set((list || []).map((it) => it.id));
      for (const [id, it] of items) {
        if (it.source === source && !keep.has(id)) {
          items.delete(id);
          dirty = true;
          snap = null;
        }
      }
      store.merge(list, now);
    },
    setStatus(id, s) {
      status.set(id, s);
      snap = null;
    },
    snapshot(now = Date.now()) {
      // States change with the clock; rebuild at most once a minute or after a change.
      if (snap && now - snap.at < 60_000) return snap.value;
      prune(now);
      const list = [...items.values()]
        .map((it) => ({ ...it, state: itemState(it, now) }))
        .sort((a, b) => {
          const rank = { active: 0, upcoming: 1, ended: 2 };
          return rank[a.state] - rank[b.state] || Date.parse(a.starts_at) - Date.parse(b.starts_at);
        });
      const value = {
        generated_at: new Date(now).toISOString(),
        sources: [...status.entries()].map(([id, s]) => ({ id, ...s })),
        items: list,
      };
      snap = { at: now, value };
      return value;
    },
    save() {
      if (!file || !dirty) return;
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify([...items.values()]));
        fs.renameSync(tmp, file);
        dirty = false;
      } catch (err) {
        console.error("Zorya local alerts save", err.message || err);
      }
    },
    load(now = Date.now()) {
      if (!file || !fs.existsSync(file)) return;
      try {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        for (const it of Array.isArray(saved) ? saved : []) {
          if (it?.id && it.starts_at && it.ends_at && Array.isArray(it.categories)) items.set(it.id, it);
        }
        prune(now);
      } catch (err) {
        console.error("Zorya local alerts load", err.message || err);
      }
    },
  };
  return store;
}

export const localStore = createLocalStore({ file: path.join(DATA_DIR, "local-alerts.json") });

// ---- optional extra feeds ------------------------------------------------------------------------

/**
 * ZORYA_LOCAL_FEEDS = JSON array of { "url", "name"?, "category"?: power|water|gas|exercise|meteo|hydro,
 * "voivodeships"?: [ids] }. Each feed is read every 10 min; items are classified like RSO notices
 * (or all filed under `category` when the feed is single-purpose, e.g. an operator's outage feed).
 */
export function parseFeedConfig(raw = process.env.ZORYA_LOCAL_FEEDS) {
  if (!raw) return [];
  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    console.error("ZORYA_LOCAL_FEEDS: niepoprawny JSON — kanały pominięte");
    return [];
  }
  return (Array.isArray(list) ? list : [])
    .map((f, i) => ({
      id: `feed${i + 1}`,
      url: safeHttpUrl(f?.url),
      name: String(f?.name || `kanał ${i + 1}`).slice(0, 80),
      category: LOCAL_CATEGORIES.includes(f?.category) ? f.category : null,
      voivodeships: (Array.isArray(f?.voivodeships) ? f.voivodeships : []).filter((v) => VOIV_IDS.has(v)),
    }))
    .filter((f) => f.url)
    .slice(0, 40);
}

const FEED_EVERY_MS = 10 * 60_000;

export function startLocalFeeds(store = localStore) {
  const feeds = parseFeedConfig();
  if (!feeds.length || !envFlag("ZORYA_LOCAL_ENABLED")) return;
  const run = async () => {
    for (const f of feeds) {
      try {
        const { text } = await getText(f.url, 15000);
        const now = Date.now();
        const rows = parseFeed(text, f.id, FEED_ITEM_LIMIT).map((it) => ({
          id: it.id,
          title: it.title,
          summary: it.desc.slice(0, f.category ? 300 : 600),
          text: it.desc,
          ts: it.ts,
          url: it.url,
          voivodeships: f.voivodeships.length ? f.voivodeships : voivFromText(`${it.title} ${it.desc}`),
          source: f.id,
          source_name: f.name,
        }));
        // Single-purpose operator feeds list a week or more ahead; keep the next OPERATOR_HORIZON_MS only.
        const items = toLocalItems(rows, now, f.category).filter((it) => !f.category || Date.parse(it.starts_at) <= now + OPERATOR_HORIZON_MS);
        store.merge(items, now);
        store.setStatus(f.id, { name: f.name, ok: true, at: new Date(now).toISOString(), records: items.length, error: null });
      } catch (err) {
        store.setStatus(f.id, { name: f.name, ok: false, at: new Date().toISOString(), records: 0, error: String(err.message || err).slice(0, 120) });
      }
    }
    store.save();
  };
  void run();
  setInterval(() => void run(), FEED_EVERY_MS).unref();
}
