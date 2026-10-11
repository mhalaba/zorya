/**
 * NOTAMs for Polish airspace (FIR EPWW by default) from the FAA's public NOTAM Search, which mirrors the
 * international NOTAM database in ICAO format. Parsed into: what (Q-code), when (B/C/D), how high (F/G)
 * and where — a polygon or circle from the E) text when the NOTAM spells it out, else the Q-line circle
 * (marked as approximate). Polled every 30 min; the last good list is kept when the source fails.
 * Informational layer: NOTAMs never change the air-threat level of a voivodeship.
 */
import { voivodeshipsForPoints } from "./fusion.mjs";
import { envFlag, fetchText } from "./util.mjs";

export const NOTAM_ENABLED = envFlag("ZORYA_NOTAM_ENABLED");
const URL_SEARCH = process.env.ZORYA_NOTAM_URL || "https://notams.aim.faa.gov/notamSearch/search";
export const NOTAM_LOCATIONS = String(process.env.ZORYA_NOTAM_LOCATIONS || "EPWW")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter((s) => /^[A-Z]{4}$/.test(s))
  .slice(0, 12);
const EVERY_MS = Math.max(15, Number(process.env.ZORYA_NOTAM_EVERY_MIN) || 30) * 60_000;
const MAX_PAGES = 30;
const PAGE_GAP_MS = 1500;
const MAX_BACKOFF_MS = 3 * 3600_000;

// ---- parsing -----------------------------------------------------------------------------------

/** Q-code subject (2nd–3rd letter) → [category, Polish label]. */
const SUBJECT = {
  RP: ["prohibited", "strefa zakazana (P)"],
  RR: ["restricted", "strefa ograniczeń (R)"],
  RD: ["danger", "strefa niebezpieczna (D)"],
  RT: ["temporary", "czasowa strefa ograniczeń"],
  RA: ["reserved", "rezerwacja przestrzeni (TSA/TRA)"],
  RM: ["military", "strefa działań wojskowych"],
  RO: ["restricted", "zakaz przelotu nad obiektem"],
  WE: ["exercise", "ćwiczenia"],
  WT: ["exercise", "masowe przeloty statków powietrznych"],
  WM: ["firing", "strzelania (pociski, rakiety, artyleria)"],
  WD: ["firing", "detonacja materiałów wybuchowych"],
  WH: ["firing", "prace strzałowe"],
  WU: ["uas", "loty bezzałogowe (BSP)"],
  WZ: ["uas", "modele latające"],
  WP: ["parachute", "skoki spadochronowe"],
  WA: ["display", "pokaz lotniczy"],
  WB: ["display", "akrobacja lotnicza"],
  WV: ["display", "lot w formacji"],
  WF: ["warning", "tankowanie w powietrzu"],
  WJ: ["warning", "holowanie banera lub celu"],
  WL: ["warning", "start balonu"],
  WG: ["warning", "loty szybowcowe"],
  WS: ["warning", "spalanie lub uwalnianie gazu"],
  WY: ["warning", "zdjęcia lotnicze"],
  GA: ["gnss", "GNSS — niedostępny lub zakłócony"],
  GW: ["gnss", "GNSS — zakłócenia w obszarze"],
};

/**
 * Subjects shown at all: airspace restrictions (R), navigation warnings (W), airspace organisation (A) and
 * GNSS interference (G). Obstacles, lighting, navaids and aerodrome services are hundreds of NOTAMs that
 * say nothing about threats from the air — they are counted, not listed.
 */
const RELEVANT = /^Q[RWAG]/;

const CONDITION = {
  CA: "aktywowana",
  CD: "dezaktywowana",
  CN: "odwołana",
  CC: "zakończona",
  LW: "odbędzie się",
  LT: "w toku",
  AH: "zmienione godziny",
  CH: "zmiana",
  CS: "zainstalowana",
  XX: "",
};
/** Conditions that mean the area is NOT in force — such NOTAMs are listed but not drawn. */
const OFF_CONDITIONS = new Set(["CD", "CN", "CC"]);
/** Categories that describe an area worth drawing. */
const ZONE_CATEGORIES = new Set(["prohibited", "restricted", "danger", "temporary", "reserved", "military", "exercise", "firing", "uas", "parachute", "display", "gnss"]);

export function classifyQcode(qcode) {
  const q = String(qcode || "").toUpperCase();
  const subject = q.slice(1, 3);
  const condition = q.slice(3, 5);
  const hit = SUBJECT[subject];
  let category = hit?.[0];
  let label = hit?.[1];
  if (!hit) {
    if (subject.startsWith("R")) [category, label] = ["restricted", "ograniczenie przestrzeni"];
    else if (subject.startsWith("W")) [category, label] = ["warning", "ostrzeżenie nawigacyjne"];
    else if (subject.startsWith("A")) [category, label] = ["airspace", "organizacja przestrzeni"];
    else if (subject.startsWith("G")) [category, label] = ["gnss", "GNSS — zakłócenia"];
    else [category, label] = ["other", "inne"];
  }
  return { subject, condition, category, label, condition_label: CONDITION[condition] ?? "" };
}

/** "2510192000" (YYMMDDHHMM, UTC) → epoch ms; null for anything else. */
export function parseNotamTime(s) {
  const m = String(s || "").match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const t = Date.UTC(2000 + +m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isFinite(t) ? t : null;
}

/** FAA list fields: "10/19/2025 2000" (UTC) → epoch ms. */
function parseFaaTime(s) {
  const m = String(s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})(\d{2})/);
  return m ? Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]) : null;
}

function flLabel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return "GND";
  if (n >= 999) return "UNL";
  return `FL${String(n).padStart(3, "0")}`;
}

/** Splits an ICAO-format NOTAM into its items. Tolerant of line breaks and missing optional items. */
export function parseIcaoNotam(message) {
  const text = String(message || "")
    .replace(/\r/g, "")
    .replace(/\s*CREATED:[\s\S]*$/i, "") // FAA appends "CREATED: … SOURCE: …"
    .replace(/[ \t]+/g, " ");
  const head = text.match(/\b([A-Z])(\d{4})\/(\d{2})\s+NOTAM([NRC])(?:\s+([A-Z]\d{4}\/\d{2}))?/);
  const pos = (label, from = 0) => {
    const re = new RegExp(`(?:^|\\s)${label}\\)\\s?`, "g");
    re.lastIndex = from;
    const m = re.exec(text);
    return m ? { at: m.index, val: m.index + m[0].length } : null;
  };
  const lastPos = (label, from) => {
    const re = new RegExp(`(?:^|\\s)${label}\\)\\s?`, "g");
    re.lastIndex = from;
    let m;
    let out = null;
    while ((m = re.exec(text))) out = { at: m.index, val: m.index + m[0].length };
    return out;
  };
  const q = pos("Q");
  const a = pos("A", q?.val ?? 0);
  const b = a && pos("B", a.val);
  const e = pos("E", (b ?? a ?? q)?.val ?? 0);
  // C) and D) only count before E): the free text may contain "C)" or "D)" of its own.
  const before = (x) => (x && (!e || x.at < e.at) ? x : null);
  const c = before(b && pos("C", b.val));
  const d = before(pos("D", (c ?? b)?.val ?? 0));
  const f = e && lastPos("F", e.val);
  const g = e && lastPos("G", (f ?? e).val);
  const cut = (from, ...next) => {
    if (!from) return "";
    const end = Math.min(...next.filter(Boolean).map((x) => x.at).filter((x) => x > from.at), text.length);
    return text.slice(from.val, end).trim();
  };
  const qLine = cut(q, a);
  const parts = qLine.split(/\s*\/\s*/);
  const coord = (parts[7] || "").match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])(\d{3})?/);
  let center = null;
  let radiusNm = null;
  if (coord) {
    const lat = (+coord[1] + +coord[2] / 60) * (coord[3] === "S" ? -1 : 1);
    const lon = (+coord[4] + +coord[5] / 60) * (coord[6] === "W" ? -1 : 1);
    center = [lon, lat];
    radiusNm = coord[7] ? +coord[7] : null;
  }
  const bVal = cut(b, c, d, e);
  const cVal = cut(c, d, e);
  return {
    id: head ? `${head[1]}${head[2]}/${head[3]}` : null,
    type: head?.[4] ?? "N",
    ref: head?.[5] ?? null,
    fir: parts[0] || null,
    qcode: /^Q[A-Z]{4}$/.test(parts[1] || "") ? parts[1] : null,
    lower_fl: parts[5] ?? null,
    upper_fl: parts[6] ?? null,
    center,
    radius_nm: radiusNm,
    location: cut(a, b) || null,
    from: parseNotamTime(bVal.split(/\s/)[0]),
    to: /PERM/.test(cVal) ? null : parseNotamTime(cVal.split(/\s/)[0]),
    permanent: /PERM/.test(cVal),
    estimated: /EST/.test(cVal),
    schedule: cut(d, e) || null,
    text: cut(e, f, g),
    lower: cut(f, g) || null,
    upper: cut(g) || null,
  };
}

// ---- geometry ----------------------------------------------------------------------------------

const COORD_RX = /(\d{2})(\d{2})(\d{2}(?:[.,]\d+)?)?\s?([NS])\s*[-,]?\s*(\d{3})(\d{2})(\d{2}(?:[.,]\d+)?)?\s?([EW])/g;

function dms(d, m, s) {
  return +d + +m / 60 + (s ? Number(String(s).replace(",", ".")) / 3600 : 0);
}

function plausible([lon, lat]) {
  return lat >= 40 && lat <= 62 && lon >= 5 && lon <= 35;
}

function destPoint(lon, lat, km, bearing) {
  const R = 6371;
  const br = (bearing * Math.PI) / 180;
  const p1 = (lat * Math.PI) / 180;
  const l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(km / R) + Math.cos(p1) * Math.sin(km / R) * Math.cos(br));
  const l2 = l1 + Math.atan2(Math.sin(br) * Math.sin(km / R) * Math.cos(p1), Math.cos(km / R) - Math.sin(p1) * Math.sin(p2));
  return [Math.round(((l2 * 180) / Math.PI) * 1e5) / 1e5, Math.round(((p2 * 180) / Math.PI) * 1e5) / 1e5];
}

export function circle([lon, lat], km, n = 48) {
  const ring = [];
  for (let i = 0; i < n; i++) ring.push(destPoint(lon, lat, km, (i / n) * 360));
  ring.push(ring[0]);
  return { type: "Polygon", coordinates: [ring] };
}

const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;

/**
 * Areas spelled out in the E) text: coordinate chains become polygons (a chain closes when it returns
 * to its first point or when other text interrupts it), "RADIUS x KM/NM" around one point a circle.
 */
export function geometryFromText(text) {
  const t = String(text || "");
  const pts = [];
  for (const m of t.matchAll(COORD_RX)) {
    const p = [dms(m[5], m[6], m[7]) * (m[8] === "W" ? -1 : 1), dms(m[1], m[2], m[3]) * (m[4] === "S" ? -1 : 1)];
    if (plausible(p)) pts.push({ p: [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5], at: m.index, end: m.index + m[0].length });
  }
  if (!pts.length) return null;
  const rings = [];
  let ring = [];
  let lastEnd = -1;
  const flush = () => {
    if (ring.length >= 3) rings.push(same(ring[0], ring[ring.length - 1]) ? ring : [...ring, ring[0]]);
    ring = [];
  };
  for (const { p, at, end } of pts) {
    const gap = lastEnd < 0 ? "" : t.slice(lastEnd, at);
    // Separators between vertices are dashes, commas, "TO", "THEN ALONG …" (short); anything longer starts a new area.
    if (ring.length && gap.replace(/[\s\-–,;:.]|TO|AND/gi, "").length > 40) flush();
    if (ring.length >= 3 && same(p, ring[0])) {
      ring.push(p);
      flush();
    } else if (!ring.length || !same(p, ring[ring.length - 1])) ring.push(p);
    lastEnd = end;
  }
  flush();
  if (rings.length) {
    return {
      geometry: rings.length === 1 ? { type: "Polygon", coordinates: [rings[0]] } : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) },
      source: "text",
    };
  }
  const rad = t.match(/RADIUS\s*(?:OF\s*)?(\d+(?:[.,]\d+)?)\s*(KM|NM|M)\b/i);
  if (rad && pts.length === 1) {
    const v = Number(rad[1].replace(",", "."));
    const km = rad[2].toUpperCase() === "NM" ? v * 1.852 : rad[2].toUpperCase() === "M" ? v / 1000 : v;
    if (km > 0 && km <= 400) return { geometry: circle(pts[0].p, km), source: "circle" };
  }
  return null;
}

function geometryPoints(g) {
  if (!g) return [];
  return g.type === "Polygon" ? g.coordinates.flat() : g.coordinates.flat(2);
}

function bboxOf(points) {
  if (!points.length) return null;
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of points) {
    a = Math.min(a, x);
    b = Math.min(b, y);
    c = Math.max(c, x);
    d = Math.max(d, y);
  }
  return [Math.round(a * 1e4) / 1e4, Math.round(b * 1e4) / 1e4, Math.round(c * 1e4) / 1e4, Math.round(d * 1e4) / 1e4];
}

// ---- items -------------------------------------------------------------------------------------

/** One FAA list row → a NOTAM item for the map/list, or null (cancellations, unreadable rows). */
export function toNotamItem(row) {
  const msg = row?.icaoMessage || row?.traditionalMessage || "";
  const p = parseIcaoNotam(msg);
  if (p.type === "C") return null; // a cancellation is not a NOTAM in force
  const id = p.id || String(row?.notamNumber || "").trim();
  if (!id) return null;
  const cls = classifyQcode(p.qcode);
  const from = p.from ?? parseFaaTime(row?.startDate);
  const to = p.permanent ? null : p.to ?? parseFaaTime(row?.endDate);
  let geo = geometryFromText(p.text);
  if (!geo && p.center && p.radius_nm && p.radius_nm <= 100 && plausible(p.center)) {
    geo = { geometry: circle(p.center, Math.max(1, p.radius_nm) * 1.852), source: "qline" };
  }
  const pts = geo ? geometryPoints(geo.geometry) : [];
  // No area → no voivodeship: a FIR-wide NOTAM's Q-line centre sits in łódzkie, but it is not about łódzkie.
  const voivodeships = geo ? voivodeshipsForPoints(p.center ? [...pts, p.center] : pts) : [];
  const off = OFF_CONDITIONS.has(cls.condition);
  return {
    id,
    location: (p.location || row?.facilityDesignator || row?.icaoId || "").slice(0, 40) || null,
    type: p.type,
    replaces: p.ref,
    qcode: p.qcode,
    category: cls.category,
    label: cls.label,
    condition: cls.condition,
    condition_label: cls.condition_label,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to).toISOString() : null,
    permanent: p.permanent,
    estimated: p.estimated,
    schedule: p.schedule ? p.schedule.slice(0, 300) : null,
    lower: p.lower || flLabel(p.lower_fl),
    upper: p.upper || flLabel(p.upper_fl),
    text: (p.text || String(row?.traditionalMessageFrom4thWord || "")).slice(0, 2000),
    raw: String(msg).slice(0, 3000),
    center: p.center,
    radius_nm: p.radius_nm,
    geometry: geo?.geometry ?? null,
    geometry_source: geo?.source ?? null,
    bbox: bboxOf(pts),
    voivodeships,
    map: !!geo && ZONE_CATEGORIES.has(cls.category) && !off,
  };
}

export function notamState(it, now = Date.now()) {
  const f = it.from ? Date.parse(it.from) : null;
  const t = it.to ? Date.parse(it.to) : null;
  if (f && now < f) return "upcoming";
  if (t && now >= t) return "ended";
  return "active";
}

// ---- polling -----------------------------------------------------------------------------------

let snap = {
  enabled: NOTAM_ENABLED,
  ok: false,
  source: "FAA NOTAM Search (notams.aim.faa.gov)",
  locations: NOTAM_LOCATIONS,
  fetched_at: null,
  error: NOTAM_ENABLED ? "jeszcze nie pobrano" : "wyłączone (ZORYA_NOTAM_ENABLED=0)",
  total: 0,
  skipped: 0,
  truncated: false,
  items: [],
};
let fails = 0;
let timer = null;
let cached = null;

function form(location, offset) {
  return new URLSearchParams({
    searchType: "0",
    designatorsForLocation: location,
    designatorForAccountable: "",
    latDegrees: "",
    latMinutes: "0",
    latSeconds: "0",
    longDegrees: "",
    longMinutes: "0",
    longSeconds: "0",
    radius: "10",
    sortColumns: "5 false",
    sortDirection: "true",
    designatorForNotamNumberSearch: "",
    notamNumber: "",
    radiusSearchOnDesignator: "false",
    radiusSearchDesignator: "",
    latitudeDirection: "N",
    longitudeDirection: "W",
    freeFormText: "",
    flightPathText: "",
    flightPathDivertAirfields: "",
    flightPathBuffer: "4",
    flightPathIncludeNavaids: "true",
    flightPathIncludeArtcc: "false",
    flightPathIncludeTfr: "true",
    flightPathIncludeRegulatory: "false",
    flightPathResultsType: "All NOTAMs",
    archiveDate: "",
    archiveDesignator: "",
    offset: String(offset),
    notamsOnly: "false",
    filters: "",
    minRunwayLength: "",
    minRunwayWidth: "",
    runwaySurfaceTypes: "",
    predefinedAbraka: "",
    predefinedDabra: "",
    flightPathAddlBuffer: "",
    recaptchaToken: "",
  }).toString();
}

async function fetchLocation(location) {
  const rows = [];
  let total = Infinity;
  let truncated = false;
  for (let page = 0; page < MAX_PAGES && rows.length < total; page++) {
    if (page) await new Promise((r) => setTimeout(r, PAGE_GAP_MS));
    const text = await fetchText(URL_SEARCH, {
      method: "POST",
      timeout: 20000,
      max: 6 * 1024 * 1024,
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "application/json" },
      body: form(location, rows.length),
    });
    const d = JSON.parse(text);
    if (d?.error) throw new Error(String(d.error).slice(0, 120));
    const list = Array.isArray(d?.notamList) ? d.notamList : null;
    if (!list) throw new Error("brak notamList w odpowiedzi");
    total = Number(d.totalNotamCount) || list.length;
    rows.push(...list);
    if (!list.length) break;
    truncated = page === MAX_PAGES - 1 && rows.length < total;
  }
  return { rows, truncated };
}

/** Items from FAA rows: parsed, filtered to relevant subjects, de-duplicated by number, ended ones dropped. */
export function itemsFromRows(rows, now = Date.now(), stats = {}) {
  const byId = new Map();
  stats.skipped = 0;
  for (const r of rows) {
    const it = toNotamItem(r);
    if (!it || notamState(it, now) === "ended") continue;
    if (it.qcode && !RELEVANT.test(it.qcode)) {
      stats.skipped += 1;
      continue;
    }
    byId.set(`${it.location}:${it.id}`, it);
  }
  return [...byId.values()];
}

async function poll() {
  const now = Date.now();
  try {
    const rows = [];
    let truncated = false;
    for (const loc of NOTAM_LOCATIONS) {
      const r = await fetchLocation(loc);
      rows.push(...r.rows);
      truncated ||= r.truncated;
    }
    const stats = {};
    const items = itemsFromRows(rows, now, stats);
    snap = { ...snap, ok: true, error: null, fetched_at: new Date(now).toISOString(), total: rows.length, skipped: stats.skipped, truncated, items };
    cached = null;
    fails = 0;
  } catch (err) {
    fails += 1;
    snap = { ...snap, ok: false, error: String(err.message || err).slice(0, 160) };
    cached = null;
    if (fails <= 3 || fails % 10 === 0) console.error(`Zorya NOTAM (#${fails})`, snap.error);
  }
  const delay = fails ? Math.min(MAX_BACKOFF_MS, EVERY_MS * 2 ** Math.min(fails - 1, 3)) : EVERY_MS;
  timer = setTimeout(() => void poll(), delay);
  timer.unref?.();
}

export function startNotams() {
  if (!NOTAM_ENABLED || timer || !NOTAM_LOCATIONS.length) return;
  void poll();
}

/** Current list with live state; ended NOTAMs disappear even while the source is down. */
export function notamSnapshot(now = Date.now()) {
  if (cached && now - cached.at < 60_000) return cached.value;
  const items = snap.items
    .map((it) => ({ ...it, state: notamState(it, now) }))
    .filter((it) => it.state !== "ended")
    .sort((a, b) => Number(b.map) - Number(a.map) || (a.state === b.state ? 0 : a.state === "active" ? -1 : 1) || String(a.from).localeCompare(String(b.from)));
  const value = { ...snap, items };
  cached = { at: now, value };
  return value;
}
