/**
 * Geography for the UA tracker: oblasts (with name stems in Ukrainian and Russian), launch zones outside
 * government-controlled Ukraine, a settlement gazetteer (GeoNames UA, CC BY 4.0) and small geodesy helpers.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’ʼ`‘´]/g, "'")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();

/** GeoNames admin1 code → oblast. `re` matches the oblast in free text (any case form, uk + ru). */
export const OBLASTS = [
  { id: "01", name: "Czerkaska", uk: "Черкащина", c: [49.25, 31.6], re: /черкащин|черкаськ\S* обл|черкасск\S* обл|черкасчин/ },
  { id: "02", name: "Czernihowska", uk: "Чернігівщина", c: [51.3, 32.0], re: /чернігівщин|чернігівськ\S* обл|черниговщин|черниговск\S* обл/ },
  { id: "03", name: "Czerniowiecka", uk: "Буковина", c: [48.35, 25.9], re: /чернівецьк\S* обл|буковин|черновицк\S* обл/ },
  { id: "04", name: "Dniepropietrowska", uk: "Дніпропетровщина", c: [48.5, 35.0], re: /дніпропетровщин|дніпропетровськ\S* обл|днепропетровщин|днепропетровск\S* обл|дніпровщин|січеславщин/ },
  { id: "05", name: "Doniecka", uk: "Донеччина", c: [48.3, 37.6], re: /донеччин|донецьк\S* обл|донецк\S* обл|донетчин/ },
  { id: "06", name: "Iwanofrankiwska", uk: "Прикарпаття", c: [48.75, 24.6], re: /франківщин|франківськ\S* обл|прикарпатт|франковск\S* обл/ },
  { id: "07", name: "Charkowska", uk: "Харківщина", c: [49.6, 36.6], re: /харківщин|харківськ\S* обл|харьковщин|харьковск\S* обл/ },
  { id: "08", name: "Chersońska", uk: "Херсонщина", c: [46.7, 33.4], re: /херсонщин|херсонськ\S* обл|херсонск\S* обл/ },
  { id: "09", name: "Chmielnicka", uk: "Хмельниччина", c: [49.45, 26.9], re: /хмельниччин|хмельницьк\S* обл|хмельницк\S* обл|хмельнитчин/ },
  { id: "10", name: "Kirowohradzka", uk: "Кіровоградщина", c: [48.4, 32.2], re: /кіровоградщин|кропивниччин|кіровоградськ\S* обл|кировоградщин|кировоградск\S* обл/ },
  { id: "11", name: "Krym", uk: "Крим", c: [45.3, 34.4], re: /\bкрим(у|і)?\b|\bкрым(а|у)?\b/ },
  { id: "13", name: "Kijowska", uk: "Київщина", c: [50.3, 30.6], re: /київщин|київськ\S* обл|киевщин|киевск\S* обл/ },
  { id: "14", name: "Ługańska", uk: "Луганщина", c: [48.8, 39.0], re: /луганщин|луганськ\S* обл|луганск\S* обл/ },
  { id: "15", name: "Lwowska", uk: "Львівщина", c: [49.8, 24.0], re: /львівщин|львівськ\S* обл|львовщин|львовск\S* обл/ },
  { id: "16", name: "Mikołajowska", uk: "Миколаївщина", c: [47.3, 31.9], re: /миколаївщин|миколаївськ\S* обл|николаевщин|николаевск\S* обл/ },
  { id: "17", name: "Odeska", uk: "Одещина", c: [46.6, 30.2], re: /одещин|одеськ\S* обл|одесск\S* обл|одесчин|одессчин/ },
  { id: "18", name: "Połtawska", uk: "Полтавщина", c: [49.6, 33.9], re: /полтавщин|полтавськ\S* обл|полтавск\S* обл/ },
  { id: "19", name: "Rówieńska", uk: "Рівненщина", c: [50.9, 26.4], re: /рівненщин|рівненськ\S* обл|ровенск\S* обл|ровенщин/ },
  { id: "21", name: "Sumska", uk: "Сумщина", c: [50.9, 34.0], re: /сумщин|сумськ\S* обл|сумск\S* обл/ },
  { id: "22", name: "Tarnopolska", uk: "Тернопільщина", c: [49.5, 25.6], re: /тернопільщин|тернопільськ\S* обл|тернопольск\S* обл|тернопольщин/ },
  { id: "23", name: "Winnicka", uk: "Вінниччина", c: [49.0, 28.6], re: /вінниччин|вінницьк\S* обл|винницк\S* обл|винничин|винниччин/ },
  { id: "24", name: "Wołyńska", uk: "Волинь", c: [51.2, 25.0], re: /волин(ь|і|ська|ській)|волынск\S* обл|волын(ь|и)/ },
  { id: "25", name: "Zakarpacka", uk: "Закарпаття", c: [48.4, 23.3], re: /закарпат/ },
  { id: "26", name: "Zaporoska", uk: "Запоріжжя (обл.)", c: [47.6, 35.6], re: /запорізьк\S* обл|запоріжчин|запорізьщин|запорожск\S* обл|запорожчин/ },
  { id: "27", name: "Żytomierska", uk: "Житомирщина", c: [50.5, 28.6], re: /житомирщин|житомирськ\S* обл|житомирск\S* обл/ },
];
export const OBLAST_BY_ID = new Map(OBLASTS.map((o) => [o.id, o]));
OBLAST_BY_ID.set("12", OBLAST_BY_ID.get("13")); // Kyiv city → Kyiv oblast for hints
OBLAST_BY_ID.set("20", OBLAST_BY_ID.get("11")); // Sevastopol → Crimea

/** All oblasts named in a text, in order of appearance. */
export function oblastsIn(text) {
  const t = norm(text);
  const hits = [];
  for (const o of OBLASTS) {
    const m = o.re.exec(t);
    if (m) hits.push({ id: o.id, at: m.index });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.id);
}

/** Launch / entry zones (codes follow MAPA.UA's from_zone list where one exists). */
export const ZONES = {
  chauda: { name: "Mys Czauda (Krym)", c: [45.0, 35.84] },
  crimea: { name: "Krym", c: [45.3, 34.4] },
  sevastopol: { name: "Sewastopol (Krym)", c: [44.6, 33.52] },
  gvardiiske: { name: "Hwardijske (Krym)", c: [45.11, 34.02] },
  black_sea_w: { name: "Morze Czarne (zachód)", c: [45.0, 31.2] },
  black_sea_e: { name: "Morze Czarne (wschód)", c: [44.5, 36.0] },
  azov: { name: "Morze Azowskie", c: [46.1, 36.6] },
  novorossiysk: { name: "Noworosyjsk (RU)", c: [44.72, 37.77] },
  primorsk: { name: "Primorsko-Achtarsk (RU)", c: [46.05, 38.17] },
  eysk: { name: "Jejsk (RU)", c: [46.71, 38.27] },
  rostov: { name: "Rostów nad Donem (RU)", c: [47.23, 39.72] },
  millerovo: { name: "Millerowo (RU)", c: [48.92, 40.4] },
  morozovsk: { name: "Morozowsk (RU)", c: [48.35, 41.83] },
  kursk: { name: "Kursk (RU)", c: [51.73, 36.19] },
  belgorod: { name: "Biełgorod (RU)", c: [50.6, 36.6] },
  bryansk: { name: "Briańsk (RU)", c: [53.24, 34.36] },
  navlya: { name: "Nawla (RU)", c: [52.83, 34.5] },
  orel: { name: "Orzeł (RU)", c: [52.97, 36.06] },
  shatalovo: { name: "Szatałowo (RU)", c: [54.33, 32.47] },
  shaykivka: { name: "Szajkowka (RU)", c: [54.23, 34.37] },
  baltimor: { name: "Woroneż / Baltimor (RU)", c: [51.7, 39.21] },
  buturlinovka: { name: "Buturlinowka (RU)", c: [50.79, 40.6] },
  engels: { name: "Engels (RU)", c: [51.48, 46.21] },
  caspian: { name: "Morze Kaspijskie", c: [42.5, 49.5] },
  mozyr: { name: "Białoruś (Mozyrz)", c: [52.05, 29.25] },
  tot_donbas: { name: "okupowany Donbas", c: [48.0, 38.0] },
  tot_zap: { name: "okupowana Zaporoska", c: [47.0, 35.3] },
};

/** Phrases after "з/із/зі/від/из/с" that name a launch zone. */
export const ZONE_PATTERNS = [
  [/брянськ|брянщин|брянск/, "bryansk"],
  [/курськ|курщин|курск/, "kursk"],
  [/бєлгород|белгород|бєлгородщин|белгородчин/, "belgorod"],
  [/орл(а|овщин)|орел|орьол|орловск/, "orel"],
  [/навл/, "navlya"],
  [/шаталов/, "shatalovo"],
  [/шайків|шайков/, "shaykivka"],
  [/міллерово|миллерово/, "millerovo"],
  [/морозовськ|морозовск/, "morozovsk"],
  [/ростов/, "rostov"],
  [/приморсько|приморско|ахтарськ|ахтарск/, "primorsk"],
  [/єйськ|ейск/, "eysk"],
  [/новоросійськ|новороссийск/, "novorossiysk"],
  [/чауд/, "chauda"],
  [/гвардійськ|гвардейск/, "gvardiiske"],
  [/севастопол/, "sevastopol"],
  [/азовськ\S* мор|азовск\S* мор|азов/, "azov"],
  [/чорн\S* мор|черн\S* мор|\bмор(я|е)\b|акваторі/, "black_sea_w"],
  [/каспі|каспи/, "caspian"],
  [/енгельс|энгельс/, "engels"],
  [/воронеж|балтимор/, "baltimor"],
  [/бутурлинів|бутурлинов/, "buturlinovka"],
  [/білорус|беларус|білорусі|мозир|мозыр/, "mozyr"],
  [/крим|крым/, "crimea"],
  [/тот\b|окупован|оккупирован/, "tot_donbas"],
];

// ---- geodesy ----------------------------------------------------------------------------------
const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
/** Distance in km between [lat, lon] points. */
export function distKm(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Initial bearing a → b in degrees (0 = north). */
export function bearing(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
/** Point `km` from `a` along `brg`. */
export function move(a, brg, km) {
  const d = km / R;
  const t = rad(brg);
  const la1 = rad(a[0]);
  const lo1 = rad(a[1]);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(t));
  const lo2 = lo1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [Math.round(deg(la2) * 1e5) / 1e5, Math.round(deg(lo2) * 1e5) / 1e5];
}

/** Compass words (uk/ru, any case form) → bearing the object comes FROM or heads TO. */
export const COMPASS = [
  [/північно-західн|северо-западн|північного заходу|северо-запада/, 315],
  [/північно-східн|северо-восточн|північного сходу|северо-востока/, 45],
  [/південно-західн|юго-западн|південного заходу|юго-запада/, 225],
  [/південно-східн|юго-восточн|південного сходу|юго-востока/, 135],
  [/північн|северн|півночі|севера/, 0],
  [/південн|южн|півдня|юга/, 180],
  [/західн|западн|заходу|запада/, 270],
  [/східн|восточн|сходу|востока/, 90],
];

// ---- gazetteer --------------------------------------------------------------------------------
let gaz = null;
function loadGaz() {
  if (gaz) return gaz;
  const raw = JSON.parse(fs.readFileSync(path.join(here, "gazetteer.json"), "utf8"));
  gaz = { places: raw.places, index: new Map(Object.entries(raw.index)) };
  return gaz;
}

/** Words that look like places but are not (oblast nicknames, generic nouns). */
const STOP = new Set(
  "область області обл район районі районе р-н місто місті город городе село селище смт напрямку напрямок курс курсом бік сторону околиці околицях межах ціль цілі групи група невідомий невідома".split(" ")
);

/** Candidate nominative forms of an inflected Ukrainian/Russian place word (lowercase). */
export function variants(w) {
  const out = new Set([w]);
  const rule = (suf, reps) => {
    if (w.length >= suf.length + 2 && w.endsWith(suf)) for (const r of reps) out.add(w.slice(0, w.length - suf.length) + r);
  };
  rule("ову", ["ів", "ов"]);
  rule("ова", ["ів", "ов"]);
  rule("ові", ["ів"]);
  rule("ева", ["ів"]);
  rule("єва", ["їв"]);
  rule("єві", ["їв"]);
  rule("ого", ["ий", "е", "ій"]);
  rule("ому", ["ий", "е"]);
  rule("ої", ["а"]);
  rule("ій", ["а", "я"]);
  rule("ою", ["а"]);
  rule("ею", ["я"]);
  rule("ця", ["ець"]);
  rule("ці", ["ець", "ця", "ка"]);
  rule("цю", ["ець"]);
  rule("ок", ["ки"]);
  rule("ців", ["ці"]);
  rule("ів", ["и", "і"]);
  rule("ках", ["ки"]);
  rule("ах", ["и", "а"]);
  rule("ях", ["і"]);
  rule("ями", ["і"]);
  rule("ами", ["и"]);
  rule("у", ["а", ""]);
  rule("ю", ["я", "ь"]);
  rule("а", [""]);
  rule("я", ["ь"]);
  rule("і", ["", "а", "я", "ь", "и"]);
  rule("и", ["а", ""]);
  rule("е", ["а"]);
  rule("ом", [""]);
  rule("ем", ["ь"]);
  // Genitive plural of "-и" towns: "до Черкас" → Черкаси, "біля Сум" → Суми, "Чернівець" handled by "ець".
  if (w.length >= 4 && /[бвгґджзклмнпрстфхцчшщ]$/u.test(w)) out.add(`${w}и`);
  return [...out];
}

function wordCombos(words) {
  let acc = [""];
  for (const w of words) {
    const vs = variants(w);
    const next = [];
    for (const a of acc) for (const v of vs) next.push(a ? `${a} ${v}` : v);
    acc = next.slice(0, 400);
  }
  return acc;
}

/**
 * Resolve a phrase (the words after a preposition, original case) to a settlement.
 * hint: oblast id or null. Returns { name, lat, lon, oblast, pop } or null.
 */
export function resolvePlace(phrase, hint = null) {
  const g = loadGaz();
  const words = String(phrase || "")
    .replace(/[«»"“”()[\],.;:!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  if (!words.length || !/^[А-ЯЄІЇҐЁ]/.test(words[0])) return null;
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const ws = words.slice(0, n).map(norm);
    if (n > 1 && !/^[А-ЯЄІЇҐЁ]/.test(words[n - 1]) && !/^[а-яєіїґ]{1,3}$/.test(ws[n - 1])) continue;
    if (STOP.has(ws[0])) return null;
    // hyphenated names: also try with the hyphen part inflected
    const combos = wordCombos(ws).flatMap((c) => (c.includes("-") ? [c, c.split("-").map((p) => variants(p)[0]).join("-")] : [c]));
    let best = null;
    for (const key of combos) {
      if (key.length < 3 || STOP.has(key)) continue;
      const ids = g.index.get(key);
      if (!ids) continue;
      const pick = choose(ids.map((i) => g.places[i]), hint);
      if (pick && (!best || pick.score > best.score)) best = { ...pick, name: words.slice(0, n).join(" "), key };
      if (best && best.exactHint) break;
    }
    if (best) return { name: title(best.key), said: best.name, lat: best.p[0], lon: best.p[1], oblast: best.p[2], pop: best.p[3] };
  }
  return null;
}

const title = (k) => k.replace(/(^|[\s-])([^\s-])/g, (_m, a, b) => a + b.toUpperCase());

function choose(cands, hint) {
  if (!cands.length) return null;
  if (hint) {
    const inObl = cands.filter((p) => p[2] === hint || (hint === "13" && p[2] === "12"));
    if (inObl.length) return { p: inObl[0], score: 3 + Math.log10(1 + inObl[0][3]) / 10, exactHint: true };
    const o = OBLAST_BY_ID.get(hint);
    if (o) {
      // Nearest to the region, but a real town beats a homonymous hamlet a bit closer
      // ("Кременець" + Рівненщина → the town in Ternopil oblast, not the pop-0 village in Volyn).
      const near = cands
        .map((p) => ({ p, d: distKm(o.c, [p[0], p[1]]), s: distKm(o.c, [p[0], p[1]]) - 25 * Math.log10(1 + (p[3] || 0)) }))
        .filter((x) => x.d < 170)
        .sort((a, b) => a.s - b.s)[0];
      if (near) return { p: near.p, score: 2 };
    }
    // A region was named but no such town is in or near it: only a big city is still believable.
    return cands[0][3] >= 50000 ? { p: cands[0], score: 1 } : null;
  }
  const top = cands[0];
  // Without a region hint only a clearly dominant town is trusted (homonymous villages are everywhere).
  // A lone hamlet (pop < 500) must not beat a city reached through another inflection ("Черкас" village vs
  // "Черкаси" city, both keys of "на Черкаси"): it scores below a dominant town (1.2+).
  if (cands.length === 1) return { p: top, score: top[3] >= 500 ? 1.5 + Math.log10(1 + top[3]) / 20 : 1 };
  const second = cands[1];
  if (top[3] >= 20000 || (top[3] >= 3000 && top[3] > 5 * (second[3] || 0))) return { p: top, score: 1.2 + Math.log10(1 + top[3]) / 10 };
  return null;
}
