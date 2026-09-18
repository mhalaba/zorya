/** Live ingest for Zorya — public OSINT only. Failed source = dead diode, empty data. */

const UA = "Zorya/0.1 (unofficial fusion; not an official warning system)";

const OBLAST_PATTERNS = [
  [/м\.?\s*київ|місто київ|kyiv city/i, "kyiv-city"],
  [/київськ/i, "kyiv"],
  [/львівськ/i, "lviv"],
  [/волинськ/i, "volyn"],
  [/закарпатськ/i, "zakarpattia"],
  [/івано-франківськ/i, "ivano-frankivsk"],
  [/рівненськ/i, "rivne"],
  [/тернопільськ/i, "ternopil"],
  [/хмельницьк/i, "khmelnytskyi"],
  [/чернівецьк/i, "chernivtsi"],
  [/житомирськ/i, "zhytomyr"],
  [/вінницьк/i, "vinnytsia"],
  [/черкаськ/i, "cherkasy"],
  [/чернігівськ/i, "chernihiv"],
  [/одеськ/i, "odesa"],
  [/кіровоградськ|кропивницьк/i, "kirovohrad"],
  [/миколаївськ/i, "mykolaiv"],
  [/полтавськ/i, "poltava"],
  [/сумськ/i, "sumy"],
  [/херсонськ/i, "kherson"],
  [/дніпропетровськ|дніпровськ/i, "dnipropetrovsk"],
  [/харківськ/i, "kharkiv"],
  [/запорізьк/i, "zaporizhzhia"],
  [/севастопол/i, "sevastopol"],
  [/крим/i, "crimea"],
  [/донецьк/i, "donetsk"],
  [/луганськ/i, "luhansk"],
];

const VOIV_FROM_TEXT = [
  [/podkarpack/i, "podkarpackie"],
  [/lubelsk/i, "lubelskie"],
  [/podlask/i, "podlaskie"],
  [/mazowieck|warszaw/i, "mazowieckie"],
  [/warmińsk|warminsk|mazursk/i, "warminsko-mazurskie"],
  [/świętokrzysk|swietokrzysk/i, "swietokrzyskie"],
  [/małopolsk|malopolsk|krakow/i, "malopolskie"],
  [/śląsk|slask/i, "slaskie"],
  [/łódzk|lodzk/i, "lodzkie"],
  [/kujawsk/i, "kujawsko-pomorskie"],
  [/zachodniopomorsk|szczecin/i, "zachodniopomorskie"],
  [/(?<!zachodnio)pomorsk/i, "pomorskie"],
  [/wielkopolsk/i, "wielkopolskie"],
  [/dolnośląsk|dolnoslask/i, "dolnoslaskie"],
  [/opolsk/i, "opolskie"],
  [/lubusk/i, "lubuskie"],
];

export function emptyInput() {
  return {
    objects: [],
    ua_alerts: [],
    rcb: { active: false, ts: Date.now(), title: "", url: null, voivodeships: [] },
    rss: [],
    zones: [],
    baltic: [],
    nato: [],
    adsb: [],
  };
}

async function getJson(url, timeout = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { json: await r.json(), at: Date.now() };
  } finally {
    clearTimeout(t);
  }
}

async function getText(url, timeout = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { text: await r.text(), at: Date.now() };
  } finally {
    clearTimeout(t);
  }
}

function matchOblast(name) {
  if (!name) return null;
  for (const [re, id] of OBLAST_PATTERNS) {
    if (re.test(name)) return id;
  }
  return null;
}

function voivFromText(text) {
  const ids = [];
  for (const [re, id] of VOIV_FROM_TEXT) {
    if (re.test(text) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function mapType(t, title = "") {
  const blob = `${t} ${title}`;
  if (/shahed|шахед|geran|геран/i.test(blob)) return "shahed";
  if (t === "ballistic" || /ballist|баліст/i.test(blob)) return "ballistic";
  if (t === "mig31k" || /mig-?31/i.test(blob)) return "mig31k";
  if (t === "missile" || /cruise|крилат|ракет/i.test(blob)) return "cruise";
  if (t === "aircraft" || t === "aero") return "aircraft";
  if (t === "helicopter") return "helicopter";
  if (t === "uav" || t === "fpv" || t === "recon" || t === "kab") return "drone";
  return "unknown";
}

function confNum(level) {
  if (level === "high") return 0.84;
  if (level === "medium") return 0.55;
  if (level === "low") return 0.3;
  return 0.45;
}

function locQuality(t) {
  if (t.areaOnly) return "region";
  if (t.positionQuality === "confirmed") return "track";
  if (t.locality && t.district) return "locality";
  return "region";
}

function lifecycleOf(t) {
  if (t.status === "stale") return "fading";
  if (t.lifecycle === "uncertain") return "fading";
  return "tracked";
}

export function mapThreats(payload) {
  const threats = payload?.threats || [];
  const out = [];
  for (const t of threats) {
    if (!t || t.status === "resolved") continue;
    if (typeof t.lat !== "number" || typeof t.lon !== "number") continue;
    const title = t.title || t.explanationShort || t.type;
    const type = mapType(t.type, title);
    const speed = t.velocity?.speedKmh ?? null;
    const course = t.areaOnly ? null : t.heading ?? t.velocity?.bearingDeg ?? null;
    const region = t.region || "";
    out.push({
      id: String(t.id),
      type,
      lat: t.lat,
      lon: t.lon,
      unc_km: Math.max(1, Number(t.uncertaintyKm) || 12),
      course,
      speed,
      eta_min: null,
      confidence: confNum(t.confidenceLevel || t.displayConfidence),
      confirmations: Number(t.sourceCount) || 1,
      loc_quality: locQuality(t),
      lifecycle: lifecycleOf(t),
      count: Number(t.count) || 1,
      ts: Date.parse(t.updatedAt || t.confirmedAt || payload.serverTime) || Date.now(),
      title: [title, t.locality || region].filter(Boolean).join(" · "),
      area_only: !!t.areaOnly,
      advisory: !!t.advisory,
    });
  }
  return out;
}

export function mapUaAlerts(payload) {
  const active = new Map();
  for (const o of payload?.oblasts || []) {
    const id = matchOblast(`${o.key || ""} ${o.name || ""} ${o.oblast || ""}`);
    if (!id) continue;
    active.set(id, Date.parse(o.since) || Date.now());
  }
  for (const r of payload?.raions || []) {
    const id = matchOblast(`${r.oblast || ""} ${r.name || ""} ${r.key || ""}`);
    if (!id) continue;
    const since = Date.parse(r.since) || Date.now();
    if (!active.has(id) || since < active.get(id)) active.set(id, since);
  }
  return [...active.entries()].map(([oblast, since]) => ({ oblast, active: true, since }));
}

function isExercise(text) {
  return /ćwiczen|cwiczen|trening|test syren|alarmowania/i.test(text);
}

function isPollution(text) {
  return /pm10|pm2.?5|smog|jakoś[cć] powietrza|py[lł] zawiesz|benzo|ozon|zanieczyszcz/i.test(text);
}

function isAirThreat(text) {
  if (isPollution(text)) return false;
  if (/mandat|przejazd|policyjn|drogow|kolejow/i.test(text) && /dron/i.test(text)) return false;
  return (
    /shahed|szached|szachęd|geran|rakiet|balist|pocisk|naruszen.{0,40}przestrzen|atak powietrz|alarm powietrz|zagrożen.{0,30}z powietrza|nalot|bezza[lł]og/i.test(text) ||
    (/\bdron|\buav|\bbp[sś]p|\bbpła/i.test(text) && /ukrain|atak|zestrzel|naruszen|shahed|rakiet|syren|alarm|uderz/i.test(text))
  );
}

function isCancel(text) {
  return /odwoł|zakończył się atak|brak zagrożenia na terytorium|odwołanie alertu/i.test(text);
}

const PROV_SLUG = {
  dolnoslaskie: "dolnoslaskie",
  "dolnośląskie": "dolnoslaskie",
  "kujawsko-pomorskie": "kujawsko-pomorskie",
  lubelskie: "lubelskie",
  lubuskie: "lubuskie",
  lodzkie: "lodzkie",
  łódzkie: "lodzkie",
  malopolskie: "malopolskie",
  małopolskie: "malopolskie",
  mazowieckie: "mazowieckie",
  opolskie: "opolskie",
  podkarpackie: "podkarpackie",
  podlaskie: "podlaskie",
  pomorskie: "pomorskie",
  slaskie: "slaskie",
  śląskie: "slaskie",
  swietokrzyskie: "swietokrzyskie",
  świętokrzyskie: "swietokrzyskie",
  "warminsko-mazurskie": "warminsko-mazurskie",
  "warmińsko-mazurskie": "warminsko-mazurskie",
  wielkopolskie: "wielkopolskie",
  zachodniopomorskie: "zachodniopomorskie",
};

function provincesFromRso(item) {
  const p = item.provinces || {};
  const ids = [];
  for (const v of Object.values(p)) {
    const slug = (v.slug_name || v.name || "").toLowerCase();
    const id = PROV_SLUG[slug] || PROV_SLUG[v.name];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function mapRso(payload) {
  const rows = (payload?.newses || [])
    .map((n) => {
      const text = `${n.title || ""} ${n.shortcut || ""} ${stripHtml(n.content || "")}`;
      const ts = Date.parse(String(n.updated_at || n.created_at || "").replace(" ", "T")) || 0;
      return { n, text, ts, voiv: provincesFromRso(n) };
    })
    .sort((a, b) => b.ts - a.ts);

  let rcb = { active: false, ts: Date.now(), title: "", url: "https://komunikaty.tvp.pl/", voivodeships: [] };
  for (const it of rows) {
    if (!it.ts) continue;
    const ageMin = (Date.now() - it.ts) / 60000;
    if (ageMin > 180) continue;
    if (!isAirThreat(it.text) || isExercise(it.text)) continue;
    const url = `https://komunikaty.tvp.pl/komunikaty/${it.n.id}/detale`;
    rcb = {
      active: !isCancel(it.text),
      ts: it.ts,
      title: it.n.shortcut || it.n.title || "Alert RCB / RSO",
      url,
      voivodeships: it.voiv,
    };
    break;
  }

  const rss = [];
  for (const it of rows) {
    const ageH = (Date.now() - it.ts) / 3600000;
    if (ageH > 2) continue;
    const url = `https://komunikaty.tvp.pl/komunikaty/${it.n.id}/detale`;
    let score = 0;
    if (isExercise(it.text) || isPollution(it.text) || /jakość wody|wodociąg|wściekliź|żeglug/i.test(it.text)) score = 0;
    else if (isAirThreat(it.text) && /syren|wybuch|naruszen|alert rcb/i.test(it.text)) score = 1;
    else if (isAirThreat(it.text)) score = 0.5;
    if (score > 0) {
      rss.push({
        id: `rso-${it.n.id}`,
        title: it.n.shortcut || it.n.title,
        url,
        ts: it.ts,
        score,
        voivodeships: it.voiv.length ? it.voiv : ["lubelskie", "podkarpackie"],
      });
    }
  }
  return { rcb, rss };
}

function stripHtml(html) {
  return String(html).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function parseRss(xml, sourceId) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const b of blocks.slice(0, 25)) {
    const title = decode(tag(b, "title"));
    const desc = decode(tag(b, "description") || tag(b, "content:encoded"));
    const link = decode(tag(b, "link"));
    const date = tag(b, "pubDate") || tag(b, "dc:date");
    const ts = Date.parse(date) || Date.now();
    items.push({ id: `${sourceId}-${hash(link || title)}`, title, desc, url: link, ts });
  }
  return items;
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${name}>`, "i"))
    || block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].trim() : "";
}

function decode(s) {
  return stripHtml(s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function scoreRssItem(item) {
  const text = `${item.title} ${item.desc}`;
  if ((Date.now() - item.ts) / 60000 > 60) return 0;
  if (isExercise(text) || isPollution(text) || /komentarz|felieton|historyczn/i.test(text)) return 0;
  if (!isAirThreat(text)) return 0;
  if (/syren|wybuch|naruszen|alert rcb|trafien|zestrzel/i.test(text)) return 1;
  return 0.5;
}

const PL_BOX = { minLat: 49.0, maxLat: 54.86, minLon: 14.07, maxLon: 24.15 };
const MIL_BOX = { minLat: 48.9, maxLat: 54.9, minLon: 21.2, maxLon: 26.8 };

function inBox(lat, lon, box) {
  return lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon;
}

function isAirborne(a) {
  if (typeof a.lat !== "number" || typeof a.lon !== "number") return false;
  if ((a.seen_pos ?? a.seen ?? 99) > 45) return false;
  if (a.alt_baro === "ground") return false;
  const cat = String(a.category || "");
  if (cat.startsWith("C")) return false;
  return true;
}

function toCraft(a, mil) {
  const alt = typeof a.alt_baro === "number" ? a.alt_baro : typeof a.alt_geom === "number" ? a.alt_geom : 0;
  return {
    id: String(a.hex || a.flight || a.r || "").trim(),
    callsign: String(a.flight || a.r || a.hex || "").trim() || (mil ? "MIL" : "CIV"),
    type: a.t || a.desc || "",
    mil: !!mil,
    lat: a.lat,
    lon: a.lon,
    heading: a.track || a.true_heading || 0,
    alt_ft: alt,
    speed_kt: a.gs || 0,
    ts: Date.now() - Math.round((a.seen_pos || 0) * 1000),
  };
}

export function mergeAdsb(plPayload, milPayload) {
  const milHex = new Set();
  const out = new Map();
  for (const a of milPayload?.ac || []) {
    if (!a?.hex) continue;
    milHex.add(a.hex);
    if (!isAirborne(a)) continue;
    if (!inBox(a.lat, a.lon, MIL_BOX) && !inBox(a.lat, a.lon, PL_BOX)) continue;
    out.set(a.hex, toCraft(a, true));
  }
  for (const a of plPayload?.ac || []) {
    if (!isAirborne(a)) continue;
    if (!inBox(a.lat, a.lon, PL_BOX)) continue;
    const hex = a.hex || `${a.lat},${a.lon}`;
    const mil = milHex.has(a.hex) || !!(Number(a.dbFlags) & 1) || !!out.get(hex)?.mil;
    out.set(hex, toCraft(a, mil));
  }
  return [...out.values()].filter((c) => c.id);
}

export function mapAdsb(payload) {
  return mergeAdsb({ ac: [] }, payload);
}

function sourceStatus(id, ok, ageS, message, records) {
  let diode = "ok";
  if (!ok) diode = "dead";
  else if (ageS > 900) diode = "dead";
  else if (ageS > 120) diode = "late";
  return { id, ok, age_s: Math.max(0, Math.round(ageS)), message, records, diode };
}

const cache = {
  neptun: { at: 0, data: null, err: "jeszcze nie pobrano" },
  ua: { at: 0, data: null, err: "jeszcze nie pobrano" },
  adsb: { at: 0, data: null, err: "jeszcze nie pobrano" },
  rso: { at: 0, data: null, err: "jeszcze nie pobrano" },
  rss: { at: 0, data: null, err: "jeszcze nie pobrano" },
};

export const INGEST_EVERY_MS = 60_000;

async function settle(name, fn) {
  try {
    const result = await fn();
    cache[name] = { at: Date.now(), data: result, err: null };
  } catch (e) {
    cache[name] = { ...cache[name], err: e.message || String(e) };
  }
}

export async function ingestLive() {
  await Promise.all([
    settle("neptun", async () => mapThreats((await getJson("https://neptun.in.ua/api/v1/threats")).json)),
    settle("ua", async () => mapUaAlerts((await getJson("https://neptun.in.ua/api/v1/alerts")).json)),
    settle("adsb", async () => {
      const [pl, mil] = await Promise.allSettled([
        getJson("https://api.adsb.lol/v2/lat/52.13/lon/19.40/dist/250"),
        getJson("https://api.adsb.lol/v2/mil"),
      ]);
      if (pl.status === "rejected" && mil.status === "rejected") {
        throw new Error(pl.reason?.message || "ADS-B niedostępny");
      }
      return mergeAdsb(
        pl.status === "fulfilled" ? pl.value.json : { ac: [] },
        mil.status === "fulfilled" ? mil.value.json : { ac: [] }
      );
    }),
    settle("rso", async () => mapRso((await getJson("https://komunikaty.tvp.pl/komunikatyxml/wszystkie/wszystkie/0?_format=json")).json)),
    settle("rss", async () => {
      const feeds = ["https://www.rmf24.pl/feed", "https://www.pap.pl/rss.xml"];
      const collected = [];
      let ok = 0;
      for (const url of feeds) {
        try {
          const { text } = await getText(url);
          collected.push(...parseRss(text, url.includes("pap") ? "pap" : "rmf"));
          ok += 1;
        } catch {
          /* one feed may fail */
        }
      }
      if (!ok) throw new Error("RSS niedostępny");
      return collected
        .map((it) => {
          const score = scoreRssItem(it);
          if (score <= 0) return null;
          const voiv = voivFromText(`${it.title} ${it.desc}`);
          return { id: it.id, title: it.title, url: it.url, ts: it.ts, score, voivodeships: voiv.length ? voiv : ["lubelskie"] };
        })
        .filter(Boolean);
    }),
  ]);

  const now = Date.now();
  const rso = cache.rso.data || { rcb: emptyInput().rcb, rss: [] };
  const rssCombined = [...(rso.rss || []), ...(cache.rss.data || [])];

  const input = {
    objects: cache.neptun.data || [],
    ua_alerts: cache.ua.data || [],
    rcb: rso.rcb || emptyInput().rcb,
    rss: rssCombined,
    zones: [],
    baltic: [],
    nato: [],
    adsb: cache.adsb.data || [],
  };

  const sources = [
    sourceStatus(
      "neptun",
      cache.neptun.data !== null,
      cache.neptun.at ? (now - cache.neptun.at) / 1000 : 9999,
      cache.neptun.data
        ? "NEPTUN OSINT, nie radar · neptun.in.ua"
        : cache.neptun.err || "brak",
      (cache.neptun.data || []).length
    ),
    sourceStatus(
      "ua",
      cache.ua.data !== null,
      cache.ua.at ? (now - cache.ua.at) / 1000 : 9999,
      cache.ua.data ? `alarmy UA (NEPTUN) · ${(cache.ua.data || []).length} obwodów` : cache.ua.err || "brak",
      (cache.ua.data || []).length
    ),
    sourceStatus(
      "adsb",
      cache.adsb.data !== null,
      cache.adsb.at ? (now - cache.adsb.at) / 1000 : 9999,
      cache.adsb.data
        ? `adsb.lol · ${(cache.adsb.data || []).filter((a) => !a.mil).length} cywilnych nad PL · ${(cache.adsb.data || []).filter((a) => a.mil).length} wojskowych · 0 pkt`
        : cache.adsb.err || "brak",
      (cache.adsb.data || []).length
    ),
    sourceStatus(
      "rss",
      cache.rss.data !== null || cache.rso.data !== null,
      Math.min(cache.rss.at || now, cache.rso.at || now) ? (now - Math.max(cache.rss.at || 0, cache.rso.at || 0)) / 1000 : 9999,
      rssCombined.length ? "RMF / PAP / RSO · treść, nie sam tytuł" : cache.rss.err || "brak relacji operacyjnych",
      rssCombined.length
    ),
    sourceStatus(
      "rcb",
      cache.rso.data !== null,
      cache.rso.at ? (now - cache.rso.at) / 1000 : 9999,
      cache.rso.err && !cache.rso.data ? cache.rso.err : rso.rcb?.active ? rso.rcb.title : "RSO · brak alertu powietrznego",
      rso.rcb?.active ? 1 : 0
    ),
    { id: "pazp", ok: true, age_s: 0, message: "brak publicznego AUP w tym cyklu — warstwa pusta", records: 0, diode: "late" },
  ];

  return { input, sources, demo: false };
}
