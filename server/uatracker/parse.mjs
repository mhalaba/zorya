/**
 * Deterministic parser for Ukrainian / Russian air-threat posts from public Telegram channels.
 * One post → zero or more events. No AI: regexes + the GeoNames gazetteer in geo.mjs.
 *
 * event = { kind, count, oblast, pos, target, next, from, heading, speed_kmh, line }
 *   pos / target / next: { name, lat, lon, oblast } (pos = where it is now, target = where it heads)
 *   from: { zone } | { oblast } | { compass }   (origin used for the first trail point / heading)
 */
import { COMPASS, OBLAST_BY_ID, ZONE_PATTERNS, bearing as bearingDeg, norm, oblastsIn, resolvePlace } from "./geo.mjs";

export const SPEED = { drone_piston: 165, drone_jet: 450, missile_cruise: 800, missile_ballistic: 3000, bomb: 500 };

const L = "А-ЯЄІЇҐЁа-яєіїґёʼ'’";
// A town: capitalised word(s); a following word only joins when capitalised too ("Біла Церква"), so
// "Хмельниччину на Віньківці" or "Черкащині повз Смілу" never swallow the preposition and the next town.
const PLACE = `([А-ЯЄІЇҐЁ][${L}\\-]*(?:[ -][А-ЯЄІЇҐЁ][${L}\\-]*){0,2})`;
const NB = `(?<![${L}])`; // not preceded by a letter
const NA = `(?![${L}])`;

const RX = {
  target: new RegExp(
    `(?:${NB}(?:курсом|курс|в напрямку|у напрямку|напрямок|в направлении|в бік|у бік|в сторону|на|до)${NA}|→|->|➡️|➡)\\s*(?:(?:на\\s+)?(?:район(?:і)?|р-н|околиці|н\\.п\\.|м\\.|с\\.|смт)\\s+)?${PLACE}`,
    "gu"
  ),
  pos: new RegExp(
    `${NB}(?:повз|біля|поблизу|над|через|в районі|у районі|в р-ні|у р-ні|в межах|районі|около|возле|мимо|в районе|над|вздовж|північніше|південніше|західніше|східніше|севернее|южнее|западнее|восточнее)${NA}\\.?\\s+(?:н\\.п\\.\\s*|м\\.\\s*|с\\.\\s*|селища\\s+|міста\\s+|села\\s+)?${PLACE}`,
    "gu"
  ),
  raion: new RegExp(`([А-ЯЄІЇҐ][${L}\\-]+?)(?:ському|цькому|зькому|ском|цком)\\s+(?:район|р-н)`, "gu"),
  from: new RegExp(`${NB}(?:з|із|зі|від|со|с|из|от|зо)\\s+([^\\s,.;:!()]+(?:\\s+[^\\s,.;:!()]+){0,2})`, "gu"),
  headingTo: /(?:у|в)\s+([а-яєіїґ-]+(?:-[а-яєіїґ]+)?)\s+(?:напрямку|направлении)/u,
  // "курс південно-західний", "курсом на південний захід", "курс схід-захід" (from east to west)
  course: /курс(?:ом)?\s+(?:на\s+)?([а-яєіїґ]+(?:[\s‑-][а-яєіїґ]+)?)/u,
  speed: /(?:швидкість|скорость|швидкістю)\s*[~≈]?\s*(\d{2,4})/u,
  count: [
    /(\d{1,3})\s*(?:х|x|×)(?![а-яєіїґa-z])/iu,
    /\((\d{1,3})\s*(?:х|x|шт|од)?\.?\)/iu,
    /(?:^|[^\d\p{L}])(\d{1,3})\s+(?:реактивн|ударн|звичайн|бпла|бп|шахед|шахід|дрон|бпл|ракет|каб|крилат|баліст|грп|груп|од|бандерол|герань|гербер|калібр|іскандер|х-)/iu,
    /(\d{1,3})\s*(?:од\.|грп|групи|груп)/iu,
  ],
};

const KIND_RX = [
  ["skip", /mavic|мавік|мавик|\bfpv\b|фпв|молні|молни|ланцет|lancet|мінувальник|квадрокоптер|разведчик|розвідник|розвідувальн|развед\S* бпла|бпла-развед|суперкам|supercam|орлан|(?:^|[^а-яєіїґ])zala|(?:^|[^а-яєіїґ])зала(?:[^а-яєіїґ]|$)/u],
  ["missile_ballistic", /баліст|баллист|іскандер|искандер|кинджал|кинжал|kn-?23|кн-?23|швидкісн\S* ціл|скоростн\S* цел|циркон/u],
  ["bomb", /(?:^|[^а-яєіїґ])каб(?:и|ів|ами)?(?:[^а-яєіїґ]|$)|керован\S* авіа|авіабомб|авиабомб|авіаційн\S* бомб|авиационн\S* бомб|(?:^|\s)бомб/u],
  // S8000 "Бандероль": a jet loitering munition; MAPA.UA files it under jet drones (subkind banderol).
  ["drone_jet", /бандерол|бандерод/u],
  ["missile_cruise", /крилат|крылат|(?:^|[^а-яєіїґ])кр(?:[^а-яєіїґ]|$)|калібр|калибр|х-?101|х-?555|х-?59|х-?69|х-?22|х-?32|х-?35|ракет|онікс|оникс/u],
  ["drone_jet", /реактив|реакт(?:[^а-яєіїґ.]|\.|$)|ректальн|еректив|🏍|джет|герань-?3|geran-?3/u],
  ["missile_cruise", /🚀/u],
  ["drone_piston", /бпла|бпла|(?:^|[^а-яєіїґ])бп(?:[^а-яєіїґ]|$)|бпл(?:[^а-яєіїґ]|$)|шахед|шахід|шохєд|шахєд|(?:^|[^а-яєіїґ])шах(?:и|ів)?(?:[^а-яєіїґ]|$)|герань|гербер|італмас|италмас|дрон|мопед|🛵|ударн|звичайн|безпілот|беспилот/u],
];

/** Kind named in a (lowercase) line, or null. "skip" = tactical drones we deliberately ignore. */
export function kindOf(lc) {
  for (const [k, re] of KIND_RX) if (re.test(lc)) return k;
  return null;
}

const BARE_RX = new RegExp(`(?:реактив\\S*|ударн\\S*|бпла|шахед\\S*|бп|мопед\\S*|🛵|🏍|🚀)\\s*${PLACE}`, "iu");
const RAION_NOM = new RegExp(`([А-ЯЄІЇҐ][${L}\\-]+?)(?:ський|цький|зький|ский|цкий)\\s+(?:район|р-н)`, "gu");
const KILL_RX = /збит|знищен|сбит|уничтож|(?:^|\s)мінус(?:\s|$|\d)|(?:^|\s)минус|ліквідован|приземлив|впав|упал/u;
const CLEAR_RX = /відбій|отбой|область чист|області чист|в області чисто|по області чисто|без фіксації|чисто\s*[📡✅]*$|не фіксу|не фиксиру|небо чисте|чисте небо|небо чистое|загроз немає|загроз нема|угроз нет/u;
/** Past-tense news about strikes and damage: not a live position report. */
const NEWS_RX = /завдав|завдали|атакував|атакували|постражд|загин|поранен|унаслідок|внаслідок|зруйнов|пошкодж|ударів по|уразил|влучан|наслідки|заявив|повідомив|за даними|минулої доби|у ніч на/u;
const ALARM_RX = /тривог|тревог|загроза застосування|угроза применения/u;
/** Siren-app style lines ("ЖОВТИЙ рівень загрози", "Дронова загроза", "Ракетна загроза (червоний рівень)"): no object. */
const LEVEL_RX = /рівень загрози|рівень небезпеки|уровень угрозы|(?:жовтий|червоний|помаранчевий|желтый|красный) рівень|(?:жовтий|червоний) рівень|дронова загроза|ракетна загроза|загроза кабів|загроза каб(?:[^а-яєіїґ]|$)|загроза для област/u;
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
  const p = resolvePlace(phrase, hint);
  if (p) return p;
  // "на Криворізький район" / "в Павлоградському районі": the raion's centre.
  const rm = phrase.match(/^([А-ЯЄІЇҐ][^\s]+?)(?:ськ|цьк|зьк)(?:ий|ого|ому|ім|ий)$/u);
  if (rm) for (const cand of [rm[1], `${rm[1]}а`, `${rm[1]}и`, `${rm[1]}е`, `${rm[1]}ськ`, rm[1].replace(/із$/u, "іг").replace(/ор$/u, "ір")]) {
    const q = resolvePlace(cand, hint);
    if (q && q.pop >= 3000) return q;
  }
  return null;
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
    if (LEVEL_RX.test(lc)) continue;

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
    const bare = line.match(BARE_RX);
    const bareTown = bare && !oblastsIn(bare[1]).length ? bare[1] : null;
    if (obls.length && !bareTown && !targets.some((m) => !oblastsIn(m[1]).length) && !poss.length && !raions.length) {
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

    // "на Черкащині" (locative) says where the object is now: the best hint for the towns in the line.
    const locObl = targets.map((m) => (/і$/u.test(m[1]) ? oblastsIn(m[1])[0] : null)).find(Boolean) || null;
    const hint = locObl || obls.find((o) => !targets.some((m) => oblastsIn(m[1])[0] === o)) || header.oblast || opts.oblast || null;
    // The previous post's weapon only carries over to short follow-ups ("Далі на X"), not to multi-region digests.
    const kind = lineKindRaw || header.kind || msgKind || (lines.length <= 2 ? opts.lastKind : null) || opts.defaultKind || null;

    // Resolve the target first: its oblast is a good hint for "повз X" when the post names no region.
    let target = null;
    let next = null;
    let tIndex = -1;
    const also = []; // "курсом на Південне, Татарбунари та Катлабуг": one group per named town
    for (const m of targets) {
      const p = placeFrom(m[1], hint);
      if (!p) continue;
      target = p;
      tIndex = m.index;
      let rest = line.slice(m.index + m[0].length);
      const LIST = new RegExp(`^\\s*(?:,\\s*|\\s+(?:та|і|й|и)\\s+)${PLACE}`, "u");
      for (let lm = rest.match(LIST), k = 0; lm && k < 8; lm = rest.match(LIST), k++) {
        const q = placeFrom(lm[1], hint || p.oblast);
        if (!q) break;
        if (!also.some((x) => x.name === q.name) && q.name !== p.name) also.push(q);
        rest = rest.slice(lm[0].length);
      }
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
    // "Реактивний Ярмолинці", "🛵 Броди", "🚀Дубровиця" (weapon word or emoji directly before a town) → position.
    if (!pos && !target && lineKindRaw && bareTown) pos = placeFrom(bareTown, phint);
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
    const cm = heading == null ? lc.match(RX.course) : null;
    if (cm) {
      const pair = cm[1].match(/^(схід|захід|північ|південь|восток|запад|север|юг)[\s‑-](схід|захід|північ|південь|восток|запад|север|юг)$/u);
      const word = pair ? pair[2] : cm[1];
      const W = { схід: 90, восток: 90, захід: 270, запад: 270, північ: 0, север: 0, південь: 180, юг: 180 };
      heading = pair ? W[word] : /^(?:південн|північн|західн|східн|южн|северн|западн|восточн)/u.test(word) ? compassOf(word.replace(/ий\s+/u, "о-")) : null;
    }
    // "повз Смілу на Київщину": no town ahead, only the region it is heading for.
    if (heading == null && pos && !target) {
      const acc = targets.map((m) => (!/і$/u.test(m[1]) ? oblastsIn(m[1])[0] : null)).find((o) => o && o !== pos.oblast);
      const ob = acc ? OBLAST_BY_ID.get(acc) : null;
      if (ob) heading = Math.round(bearingDeg([pos.lat, pos.lon], ob.c));
    }
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
    const count = countOf(line);
    if (also.length && count > 1 && also.length + 1 > count) also.splice(count - 1);
    const subkind = kind === "drone_jet" && /бандерол|бандерод/u.test(/бандерол|бандерод/u.test(lc) ? lc : lcAll) ? "banderol" : null;
    // A count spread over a list of towns: split it, the first town keeps the remainder.
    const share = also.length && !pos ? Math.max(1, Math.floor(count / (also.length + 1))) : count;
    for (const q of pos ? [] : also)
      out.events.push({ kind, subkind, count: share, oblast: q.oblast === "12" ? "13" : q.oblast, pos: null, target: q, next: null, from, heading: null, speed_kmh: null, line: line.slice(0, 300) });
    out.events.push({
      kind,
      subkind,
      count: also.length && !pos ? Math.max(1, count - share * also.length) : count,
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
