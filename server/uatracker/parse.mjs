/**
 * Deterministic parser for Ukrainian / Russian air-threat posts from public Telegram channels.
 * One post → zero or more events. No AI: regexes + the GeoNames gazetteer in geo.mjs.
 *
 * event = { kind, count, oblast, pos, target, next, from, heading, speed_kmh, line }
 *   pos / target / next: { name, lat, lon, oblast } (pos = where it is now, target = where it heads)
 *   from: { zone } | { oblast } | { compass }   (origin used for the first trail point / heading)
 */
import { COMPASS, ZONE_PATTERNS, norm, oblastsIn, resolvePlace } from "./geo.mjs";

export const SPEED = { drone_piston: 165, drone_jet: 450, missile_cruise: 800, missile_ballistic: 3000, bomb: 500 };

const L = "А-ЯЄІЇҐЁа-яєіїґёʼ'’";
const PLACE = `([А-ЯЄІЇҐЁ][${L}\\-]*(?:[ -][${L}][${L}\\-]*){0,2})`;
const NB = `(?<![${L}])`; // not preceded by a letter
const NA = `(?![${L}])`;

const RX = {
  target: new RegExp(
    `(?:${NB}(?:курсом|курс|в напрямку|у напрямку|напрямок|в направлении|в бік|у бік|в сторону|на|до)${NA}|→|->|➡️|➡)\\s*(?:(?:на\\s+)?(?:район(?:і)?|р-н|околиці|н\\.п\\.|м\\.|с\\.|смт)\\s+)?${PLACE}`,
    "gu"
  ),
  pos: new RegExp(
    `${NB}(?:повз|біля|поблизу|над|через|в районі|у районі|в р-ні|у р-ні|в межах|районі|около|возле|мимо|в районе|над|вздовж)${NA}\\s+(?:н\\.п\\.\\s*|м\\.\\s*|с\\.\\s*|селища\\s+|міста\\s+|села\\s+)?${PLACE}`,
    "gu"
  ),
  raion: new RegExp(`([А-ЯЄІЇҐ][${L}\\-]+?)(?:ському|цькому|зькому|ском|цком)\\s+(?:район|р-н)`, "gu"),
  from: new RegExp(`${NB}(?:з|із|зі|від|со|с|из|от|зо)\\s+([^\\s,.;:!()]+(?:\\s+[^\\s,.;:!()]+){0,2})`, "gu"),
  headingTo: /(?:у|в)\s+([а-яєіїґ-]+(?:-[а-яєіїґ]+)?)\s+(?:напрямку|направлении)/u,
  speed: /(?:швидкість|скорость|швидкістю)\s*[~≈]?\s*(\d{2,4})/u,
  count: [
    /(\d{1,3})\s*(?:х|x|×)(?![а-яєіїґa-z])/iu,
    /\((\d{1,3})\s*(?:х|x|шт|од)?\.?\)/iu,
    /(?:^|\s)(\d{1,3})\s+(?:реактивн|ударн|звичайн|бпла|бп|шахед|шахід|дрон|бпл|ракет|каб|крилат|баліст|грп|груп|од|бандерол|герань|гербер|калібр|іскандер|х-)/iu,
    /(\d{1,3})\s*(?:од\.|грп|групи|груп)/iu,
  ],
};

const KIND_RX = [
  ["skip", /mavic|мавік|мавик|\bfpv\b|фпв|молні|молни|ланцет|lancet|мінувальник|квадрокоптер/u],
  ["missile_ballistic", /баліст|баллист|іскандер|искандер|кинджал|кинжал|kn-?23|кн-?23|швидкісн\S* ціл|скоростн\S* цел|циркон/u],
  ["bomb", /(?:^|[^а-яєіїґ])каб(?:и|ів|ами)?(?:[^а-яєіїґ]|$)|керован\S* авіа|авіабомб|авиабомб|авіаційн\S* бомб|авиационн\S* бомб|(?:^|\s)бомб/u],
  ["missile_cruise", /крилат|крылат|(?:^|[^а-яєіїґ])кр(?:[^а-яєіїґ]|$)|калібр|калибр|х-?101|х-?555|х-?59|х-?69|х-?22|х-?32|х-?35|бандерол|ракет|🚀|онікс|оникс/u],
  ["drone_jet", /реактивн|реакт(?:[^а-яєіїґ]|$)|🏍|джет|герань-?3|geran-?3/u],
  ["drone_piston", /бпла|бпла|(?:^|[^а-яєіїґ])бп(?:[^а-яєіїґ]|$)|бпл(?:[^а-яєіїґ]|$)|шахед|шахід|шохєд|шахєд|(?:^|[^а-яєіїґ])шах(?:и|ів)?(?:[^а-яєіїґ]|$)|герань|гербер|італмас|италмас|дрон|мопед|🛵|ударн|звичайн|безпілот|беспилот/u],
];

/** Kind named in a (lowercase) line, or null. "skip" = tactical drones we deliberately ignore. */
export function kindOf(lc) {
  for (const [k, re] of KIND_RX) if (re.test(lc)) return k;
  return null;
}

const RAION_NOM = new RegExp(`([А-ЯЄІЇҐ][${L}\\-]+?)(?:ський|цький|зький|ский|цкий)\\s+(?:район|р-н)`, "gu");
const KILL_RX = /збит|знищен|сбит|уничтож|(?:^|\s)мінус(?:\s|$|\d)|(?:^|\s)минус|ліквідован|приземлив|впав|упал/u;
const CLEAR_RX = /відбій|отбой|область чист|області чист|в області чисто|по області чисто|без фіксації|чисто\s*[📡✅]*$|не фіксу|не фиксиру|небо чисте|чисте небо|небо чистое|загроз немає|загроз нема|угроз нет/u;
/** Past-tense news about strikes and damage: not a live position report. */
const NEWS_RX = /завдав|завдали|атакував|атакували|постражд|загин|поранен|унаслідок|внаслідок|зруйнов|пошкодж|ударів по|уразил|влучан|наслідки|заявив|повідомив|за даними|минулої доби|у ніч на/u;
const ALARM_RX = /тривог|тревог|загроза застосування|угроза применения/u;
/** Things after "на/до" that are not places. */
const NOT_PLACE = /^(Мапа|Карта|Увага|Уточнюється|Наразі|Ціль|Цілі|Повітрян|Тривог|Відбій|Загроза|Схід|Захід|Північ|Південь|Схід|Час|Висот|Швидк|Дорозвідк)/u;

/** Strip channel signatures, promo blocks and links that follow the actual report. */
export function cleanText(text) {
  let t = String(text || "").replace(/\r/g, "");
  const cut = t.search(/☎️|✙|🦇|➡\s*Підписатися|✅\s*Розвідка|Підтримати канал|Подписаться|ФОП:|Чатик|㤀/u);
  if (cut > 0) t = t.slice(0, cut);
  return t
    .split("\n")
    .map((l) => l.replace(/https?:\/\/\S+/g, "").replace(/@\w{4,}/g, "").replace(/ㅤ/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function countOf(line) {
  for (const re of RX.count) {
    const m = re.exec(line);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 300) return n;
    }
  }
  if (/(?:^|\s)(?:дві|два|двоє|пара|пару|двійка)(?:\s|$)/iu.test(line)) return 2;
  if (/(?:^|\s)(?:три|трійка|троє)(?:\s|$)/iu.test(line)) return 3;
  if (/(?:^|\s)групи?(?:\s|$)|группа/iu.test(line)) return 2;
  return 1;
}

function compassOf(lc) {
  for (const [re, b] of COMPASS) if (re.test(lc)) return b;
  return null;
}

function originOf(fragment) {
  const lc = norm(fragment);
  for (const [re, zone] of ZONE_PATTERNS) if (re.test(lc)) return { zone };
  const ob = oblastsIn(lc);
  if (ob.length) return { oblast: ob[0] };
  const c = compassOf(lc);
  if (c != null) return { compass: c };
  return null;
}

function placeFrom(phrase, hint) {
  if (!phrase || NOT_PLACE.test(phrase)) return null;
  if (oblastsIn(phrase).length) return null; // "на Сумщині" is a region, not a town
  return resolvePlace(phrase, hint);
}

/**
 * Parse one post.
 * opts: { oblast: default oblast of a regional channel, defaultKind, national: bool }
 */
export function parsePost(rawText, opts = {}) {
  const out = { events: [], clears: [], kills: [], regional: [], unparsed: [] };
  const text = cleanText(rawText);
  if (!text || text.length > 900) return out; // long posts are news / summaries, not tracking updates
  const lcAll = norm(text);
  if (/графік|графика|відключен|отключени|донат|збір|сбор на|розіграш|реклама/u.test(lcAll) && !kindOf(lcAll)) return out;
  const msgKind = (() => {
    const k = kindOf(lcAll);
    return k === "skip" ? null : k;
  })();

  let header = { oblast: opts.oblast || null, kind: null };
  const lines = text.split(/\n|;\s*/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lc = norm(line);
    if (/^(?:по бпла|по ракетах|особлива увага|орієнтовний рух|мапа|карта)/u.test(lc)) continue;
    const obls = oblastsIn(lc);
    const lineKindRaw = kindOf(lc);
    if (lineKindRaw === "skip") continue;
    if (NEWS_RX.test(lc)) continue;

    // Kill / all-clear first: they carry no new position.
    if (KILL_RX.test(lc) && !/курс|→|напрям/u.test(lc)) {
      const m = [...line.matchAll(RX.pos), ...line.matchAll(RX.target)][0];
      out.kills.push({ kind: lineKindRaw || msgKind, place: m ? placeFrom(m[1], obls[0] || header.oblast) : null, oblast: obls[0] || header.oblast, line });
      continue;
    }
    if (CLEAR_RX.test(lc) && !/курс|→|на [А-ЯЄІЇҐ]/u.test(line)) {
      // "Ніжинський район — відбій": clears around the raion centre only.
      const rm = [...line.matchAll(RX.raion)][0] || [...line.matchAll(RAION_NOM)][0];
      if (rm) {
        let place = null;
        for (const cand of [rm[1], `${rm[1]}ський`, `${rm[1]}а`, `${rm[1]}и`, `${rm[1]}е`]) {
          place = placeFrom(cand, obls[0] || header.oblast || opts.oblast || null);
          if (place) break;
        }
        if (place) out.clears.push({ place, oblast: place.oblast, all: false, line });
        continue;
      }
      if (/район/u.test(lc)) continue;
      const nationwide = /не фіксу|не фиксиру|небо чисте|чисте небо|небо чистое|загроз немає|загроз нема|угроз нет|всій україні|всей украине/u.test(lc);
      out.clears.push({ oblast: obls[0] || header.oblast || null, all: nationwide && !obls.length && !header.oblast && !!opts.national, line });
      continue;
    }

    // Header line: "Чернігівщина:" / "🛵 Вінниччина" / "Херсонщина Моніторинг"
    const targets = [...line.matchAll(RX.target)].filter((m) => !NOT_PLACE.test(m[1]));
    const poss = [...line.matchAll(RX.pos)];
    const raions = [...line.matchAll(RX.raion)];
    if (obls.length && !targets.some((m) => !oblastsIn(m[1]).length) && !poss.length && !raions.length) {
      const fromMatch = /(?:^|\s)(?:з|із|зі|от|из|с)\s+\S*щин/u.test(lc);
      if (!fromMatch) {
        header = { oblast: obls[0], kind: lineKindRaw || null };
        if (lineKindRaw && !ALARM_RX.test(lc) && line.replace(/[^\p{L}]/gu, "").length > 0) {
          const cnt = countOf(line);
          if (/\d/.test(line) || /бп|ударн|реактивн|керован|ракет/u.test(lc)) out.regional.push({ kind: lineKindRaw, count: cnt, oblast: obls[0], line });
        }
        continue;
      }
    }
    if (ALARM_RX.test(lc) && !lineKindRaw) continue;

    const hint = obls.find((o) => !targets.some((m) => oblastsIn(m[1])[0] === o)) || header.oblast || opts.oblast || null;
    const kind = lineKindRaw || header.kind || msgKind || opts.lastKind || opts.defaultKind || null;

    // Resolve the target first: its oblast is a good hint for "повз X" when the post names no region.
    let target = null;
    let next = null;
    let tIndex = -1;
    for (const m of targets) {
      const p = placeFrom(m[1], hint);
      if (!p) continue;
      target = p;
      tIndex = m.index;
      // "→Кіпті/Київщина", "на Кобеляки/Білики": the part after "/" is the next waypoint or region.
      const after = line.slice(m.index + m[0].length).match(/^\s*\/\s*([^/,;.]+)/u);
      if (after) {
        const nx = placeFrom(after[1].trim(), hint || p.oblast);
        const nob = oblastsIn(after[1]);
        next = nx || (nob.length ? { oblast: nob[0] } : null);
      }
      break;
    }
    const phint = hint || target?.oblast || null;
    let pos = null;
    for (const m of poss) {
      pos = placeFrom(m[1], phint);
      if (pos) break;
    }
    // "Михайлівка на Райгород": a town right before the target preposition is the current position.
    if (!pos && target && tIndex > 0) {
      const lead = line.slice(0, tIndex).replace(/[^\p{L}\s'ʼ’-]/gu, " ").trim();
      if (lead && !kindOf(norm(lead)) && /^[А-ЯЄІЇҐ]/u.test(lead) && lead.split(/\s+/).length <= 3) pos = placeFrom(lead, phint);
    }
    if (!pos) {
      for (const m of raions) {
        for (const cand of [m[1], `${m[1]}ський`, `${m[1]}а`, `${m[1]}и`, `${m[1]}е`]) {
          pos = placeFrom(cand, phint);
          if (pos) break;
        }
        if (pos) break;
      }
    }
    if (pos && target && pos.lat === target.lat && pos.lon === target.lon) target = null;
    // "Реактивний Ярмолинці" (kind word directly followed by a town) → position.
    if (!pos && !target && lineKindRaw) {
      const m = line.match(new RegExp(`(?:реактивн\\S*|ударн\\S*|бпла|шахед\\S*|бп)\\s+${PLACE}`, "iu"));
      if (m) pos = placeFrom(m[1], phint);
    }
    // "Дрімайлівка гербера", "Ямпіль невідомий БпЛа": a town first, then the weapon.
    if (!pos && !target && lineKindRaw) {
      const m = line.match(new RegExp(`^[^А-ЯЄІЇҐЁ]*${PLACE}\\s+(?:невідом\\S*\\s+)?(?:реактивн|ударн|бпла|бпл|шахед|шах|гербер|герань|італмас|мопед|бандерол|каб)`, "iu"));
      if (m) pos = placeFrom(m[1].split(/\s+/).filter((w) => !kindOf(norm(w))).join(" "), phint);
    }
    if (!pos && !target && obls.length === 0 && !kind) continue;

    let from = null;
    for (const m of line.matchAll(RX.from)) {
      const o = originOf(m[1]);
      if (o) {
        from = o;
        break;
      }
    }
    let heading = null;
    const hm = lc.match(RX.headingTo);
    if (hm) heading = compassOf(hm[1]);
    const sm = lc.match(RX.speed);
    const speed = sm ? Number(sm[1]) : null;

    if (!pos && !target) {
      if (kind && (obls.length || header.oblast)) out.regional.push({ kind, count: countOf(line), oblast: obls[0] || header.oblast, line });
      else if (kind) out.unparsed.push(line);
      continue;
    }
    if (!kind) {
      out.unparsed.push(line);
      continue;
    }
    out.events.push({
      kind,
      count: countOf(line),
      oblast: (pos || target).oblast === "12" ? "13" : (pos || target).oblast,
      pos,
      target,
      next,
      from,
      heading,
      speed_kmh: speed && speed > 50 && speed < 5000 ? speed : null,
      line: line.slice(0, 300),
    });
  }
  return out;
}
