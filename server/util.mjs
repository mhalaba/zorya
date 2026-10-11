/** Shared helpers for the ingest modules: capped HTTP fetches, RSS/Atom, Warsaw time, voivodeships from text. */

export const UA = "Zorya/0.1 (unofficial fusion; not an official warning system; +https://zorya.website)";
/** Upstream answers above this are refused: a broken or hostile source must not exhaust memory. */
export const MAX_BODY = 8 * 1024 * 1024;

async function readCapped(r, max) {
  const len = Number(r.headers.get("content-length"));
  if (Number.isFinite(len) && len > max) throw new Error(`odpowiedź za duża (${len} B)`);
  if (!r.body) return "";
  const reader = r.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`odpowiedź za duża (>${max} B)`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** fetch with a timeout and a body cap; returns the text. Non-2xx → Error("HTTP nnn"). */
export async function fetchText(url, { timeout = 12000, max = MAX_BODY, method = "GET", headers = {}, body } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { method, body, signal: ctrl.signal, headers: { "User-Agent": UA, ...headers } });
    if (!r.ok) {
      await r.body?.cancel().catch(() => undefined);
      throw new Error(`HTTP ${r.status}`);
    }
    return await readCapped(r, max);
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("timeout");
    // undici hides the reason ("fetch failed"); the diode should say ENOTFOUND / ECONNRESET / cert error.
    if (e?.message === "fetch failed" && e.cause) throw new Error(`fetch failed: ${e.cause.code || e.cause.message || e.cause}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function getJson(url, timeout = 12000) {
  const text = await fetchText(url, { timeout, headers: { Accept: "application/json" } });
  return { json: JSON.parse(text), at: Date.now() };
}

export async function getText(url, timeout = 12000) {
  const text = await fetchText(url, { timeout, headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
  return { text, at: Date.now() };
}

export function stripHtml(html) {
  return String(html).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function codePoint(n) {
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
}

export function decode(s) {
  // &amp; last, so "&amp;lt;" stays the literal text "&lt;" instead of becoming a tag.
  return stripHtml(
    String(s)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => codePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => codePoint(parseInt(n, 16)))
      .replace(/&amp;/g, "&")
  );
}

export function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${name}>`, "i"))
    || block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].trim() : "";
}

/** RSS 2.0 / RDF / Atom → [{ id, title, desc, url, ts }]. ts = 0 when the date is missing (never "fresh"). */
export function parseFeed(xml, sourceId, limit = 25) {
  // A dead feed may answer 200 with an HTML page ("Not found.") — that is a failure, not an empty feed.
  const atom = /<feed[\s>]/i.test(xml) && !/<(?:rss|rdf:RDF)[\s>]/i.test(xml);
  if (!atom && !/<(?:rss|rdf:RDF)[\s>]/i.test(xml)) throw new Error("odpowiedź nie jest kanałem RSS/Atom");
  const blocks = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, limit).map((b) => {
    const title = decode(tag(b, "title"));
    const desc = decode(atom ? tag(b, "summary") || tag(b, "content") : tag(b, "description") || tag(b, "content:encoded"));
    const link = atom ? (b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "") : decode(tag(b, "link"));
    const date = atom ? tag(b, "updated") || tag(b, "published") : tag(b, "pubDate") || tag(b, "dc:date");
    const ts = Date.parse(date) || 0;
    return { id: `${sourceId}-${hash(link || title)}`, title, desc, url: link.replace(/&amp;/g, "&"), ts };
  });
}

// Stems must not match inside other names: "opolsk" ⊂ "małopolsk"/"wielkopolsk", "śląsk" ⊂ "dolnośląsk",
// "pomorsk" ⊂ "kujawsko-pomorsk"/"zachodniopomorsk", "podlask" ⊂ "Biała Podlaska" (lubelskie).
const VOIV_FROM_TEXT = [
  [/podkarpack|rzesz[oó]w|przemy[sś]l/iu, "podkarpackie"],
  [/lubelsk|lublin(?!iec)|zamo[sś][cć]|che[lł]m(?![nżz]|ek|ku)|bia[lł]\p{L}{0,3}\s+podlask/iu, "lubelskie"],
  [/(?<!bia[lł]\p{L}{0,3}\s+)podlask|bia[lł]\p{L}{0,3}stok|suwa[lł]k/iu, "podlaskie"],
  [/mazowieck|warszaw/iu, "mazowieckie"],
  [/warmińsk|warminsk|mazursk|olsztyn/iu, "warminsko-mazurskie"],
  [/świętokrzysk|swietokrzysk|kielc/iu, "swietokrzyskie"],
  [/małopolsk|malopolsk|krak[oó]w/iu, "malopolskie"],
  [/(?<!dolno|doln\p{L}{0,3}\s+)(?:śląsk|slask)|katowic/iu, "slaskie"],
  [/łódzk|lodzk/iu, "lodzkie"],
  [/kujawsk|bydgoszcz/iu, "kujawsko-pomorskie"],
  [/zachodniopomorsk|szczecin/iu, "zachodniopomorskie"],
  [/(?<!\p{L}|kujawsko[-\s])pomorsk|gda[nń]sk|gdyni/iu, "pomorskie"],
  [/wielkopolsk|pozna[nń]/iu, "wielkopolskie"],
  [/dolnośląsk|dolnoslask|doln\p{L}{0,3}\s+(?:śląsk|slask)|wroc[lł]aw/iu, "dolnoslaskie"],
  [/(?<!\p{L})opolsk/iu, "opolskie"],
  [/lubusk/iu, "lubuskie"],
];

export function voivFromText(text) {
  const ids = [];
  for (const [re, id] of VOIV_FROM_TEXT) {
    if (re.test(text) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

const WARSAW_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Warsaw",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function warsawOffsetMs(utcMs) {
  const p = Object.fromEntries(WARSAW_PARTS.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Polish wall-clock time → epoch ms (DST-correct, independent of the server's TZ). month is 1-based. */
export function warsawToUtc(y, mo, d, h = 0, mi = 0, s = 0) {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const guess = wall - warsawOffsetMs(wall);
  return wall - warsawOffsetMs(guess);
}

/** Calendar date of an instant in Warsaw: { y, mo, d }. */
export function warsawDate(ms) {
  const p = Object.fromEntries(WARSAW_PARTS.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day };
}

/** RSO stamps are Polish wall-clock time without a zone ("2026-09-18 11:42:38"); parse them independent of the server TZ. */
export function parseWarsawTime(s) {
  const str = String(s || "").trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(str)) return Date.parse(str) || 0;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  return warsawToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0));
}

/** "off", "0", "false", "no" → false; anything else (or unset with dflt=true) → true. */
export function envFlag(name, dflt = true) {
  const v = process.env[name];
  if (v == null || v === "") return dflt;
  return !/^(0|false|off|no)$/i.test(String(v).trim());
}
