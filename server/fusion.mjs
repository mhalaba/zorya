/** Zorya fusion engine — scoring per voivodeship in a 60-minute window. */

export const SOURCE_IDS = ["neptun", "ua", "adsb", "rss", "rcb", "pazp"];

export const VOIV = [
  { id: "dolnoslaskie", name: "dolnośląskie", nameEn: "Lower Silesian", eastRank: 13, lat: 51.0897, lon: 16.4105, neighbors: ["lubuskie", "wielkopolskie", "opolskie"] },
  { id: "kujawsko-pomorskie", name: "kujawsko-pomorskie", nameEn: "Kuyavian-Pomeranian", eastRank: 8, lat: 53.0726, lon: 18.4879, neighbors: ["pomorskie", "warminsko-mazurskie", "mazowieckie", "lodzkie", "wielkopolskie"] },
  { id: "lubelskie", name: "lubelskie", nameEn: "Lublin", eastRank: 1, lat: 51.2208, lon: 22.9004, neighbors: ["podlaskie", "mazowieckie", "swietokrzyskie", "podkarpackie"] },
  { id: "lubuskie", name: "lubuskie", nameEn: "Lubusz", eastRank: 14, lat: 52.1962, lon: 15.3428, neighbors: ["zachodniopomorskie", "wielkopolskie", "dolnoslaskie"] },
  { id: "lodzkie", name: "łódzkie", nameEn: "Łódź", eastRank: 7, lat: 51.6048, lon: 19.4177, neighbors: ["wielkopolskie", "kujawsko-pomorskie", "mazowieckie", "swietokrzyskie", "slaskie", "opolskie"] },
  { id: "malopolskie", name: "małopolskie", nameEn: "Lesser Poland", eastRank: 6, lat: 49.859, lon: 20.2693, neighbors: ["slaskie", "swietokrzyskie", "podkarpackie"] },
  { id: "mazowieckie", name: "mazowieckie", nameEn: "Masovian", eastRank: 4, lat: 52.346, lon: 21.0964, neighbors: ["warminsko-mazurskie", "podlaskie", "lubelskie", "swietokrzyskie", "lodzkie", "kujawsko-pomorskie"] },
  { id: "opolskie", name: "opolskie", nameEn: "Opole", eastRank: 12, lat: 50.647, lon: 17.8999, neighbors: ["dolnoslaskie", "lodzkie", "slaskie"] },
  { id: "podkarpackie", name: "podkarpackie", nameEn: "Subcarpathian", eastRank: 2, lat: 49.9539, lon: 22.1692, neighbors: ["malopolskie", "swietokrzyskie", "lubelskie"] },
  { id: "podlaskie", name: "podlaskie", nameEn: "Podlaskie", eastRank: 0, lat: 53.2647, lon: 22.9294, neighbors: ["warminsko-mazurskie", "mazowieckie", "lubelskie"] },
  { id: "pomorskie", name: "pomorskie", nameEn: "Pomeranian", eastRank: 9, lat: 54.1548, lon: 17.9867, neighbors: ["zachodniopomorskie", "wielkopolskie", "kujawsko-pomorskie", "warminsko-mazurskie"] },
  { id: "slaskie", name: "śląskie", nameEn: "Silesian", eastRank: 10, lat: 50.331, lon: 18.9939, neighbors: ["opolskie", "lodzkie", "swietokrzyskie", "malopolskie"] },
  { id: "swietokrzyskie", name: "świętokrzyskie", nameEn: "Holy Cross", eastRank: 5, lat: 50.7635, lon: 20.7692, neighbors: ["mazowieckie", "lubelskie", "podkarpackie", "malopolskie", "slaskie", "lodzkie"] },
  { id: "warminsko-mazurskie", name: "warmińsko-mazurskie", nameEn: "Warmian-Masurian", eastRank: 3, lat: 53.8573, lon: 20.8248, neighbors: ["pomorskie", "kujawsko-pomorskie", "mazowieckie", "podlaskie"] },
  { id: "wielkopolskie", name: "wielkopolskie", nameEn: "Greater Poland", eastRank: 11, lat: 52.3307, lon: 17.2432, neighbors: ["zachodniopomorskie", "pomorskie", "kujawsko-pomorskie", "lodzkie", "dolnoslaskie", "lubuskie"] },
  { id: "zachodniopomorskie", name: "zachodniopomorskie", nameEn: "West Pomeranian", eastRank: 15, lat: 53.5848, lon: 15.5431, neighbors: ["pomorskie", "wielkopolskie", "lubuskie"] },
];

export const EAST_IDS = new Set(["podlaskie", "lubelskie", "podkarpackie", "mazowieckie", "warminsko-mazurskie"]);
export const NORTH_IDS = new Set(["pomorskie", "zachodniopomorskie", "warminsko-mazurskie", "kujawsko-pomorskie"]);
export const BALTIC_FULL = new Set(["podlaskie", "warminsko-mazurskie", "pomorskie"]);

export const UA_OBLASTS = [
  { id: "lviv", name: "lwowski", nameEn: "Lviv", distKm: 0.5, lat: 49.7241, lon: 23.9162 },
  { id: "volyn", name: "wołyński", nameEn: "Volyn", distKm: 0.5, lat: 51.2026, lon: 24.8818 },
  { id: "zakarpattia", name: "zakarpacki", nameEn: "Zakarpattia", distKm: 0.7, lat: 48.4049, lon: 23.2813 },
  { id: "ivano-frankivsk", name: "iwanofrankiwski", nameEn: "Ivano-Frankivsk", distKm: 49.1, lat: 48.7051, lon: 24.6093 },
  { id: "rivne", name: "rówieński", nameEn: "Rivne", distKm: 71.6, lat: 51.0434, lon: 26.3976 },
  { id: "ternopil", name: "tarnopolski", nameEn: "Ternopil", distKm: 104.0, lat: 49.4026, lon: 25.64 },
  { id: "khmelnytskyi", name: "chmielnicki", nameEn: "Khmelnytskyi", distKm: 156.9, lat: 49.509, lon: 26.9303 },
  { id: "chernivtsi", name: "czerniowiecki", nameEn: "Chernivtsi", distKm: 182.2, lat: 48.2698, lon: 25.9711 },
  { id: "zhytomyr", name: "żytomierski", nameEn: "Zhytomyr", distKm: 216.7, lat: 50.6426, lon: 28.4846 },
  { id: "vinnytsia", name: "winnicki", nameEn: "Vinnytsia", distKm: 279.9, lat: 48.9265, lon: 28.6921 },
  { id: "kyiv", name: "kijowski", nameEn: "Kyiv Oblast", distKm: 361.4, lat: 50.3014, lon: 30.4778 },
  { id: "kyiv-city", name: "Kijów", nameEn: "Kyiv", distKm: 432.5, lat: 50.4578, lon: 30.5222 },
  { id: "cherkasy", name: "czerkaski", nameEn: "Cherkasy", distKm: 429.5, lat: 49.2536, lon: 31.3784 },
  { id: "odesa", name: "odeski", nameEn: "Odesa", distKm: 439.6, lat: 46.745, lon: 29.8653 },
  { id: "chernihiv", name: "czernihowski", nameEn: "Chernihiv", distKm: 443.8, lat: 51.3472, lon: 32.0167 },
  { id: "kirovohrad", name: "kirowohradzki", nameEn: "Kirovohrad", distKm: 476.0, lat: 48.4608, lon: 32.1072 },
  { id: "mykolaiv", name: "mikołajowski", nameEn: "Mykolaiv", distKm: 522.2, lat: 47.442, lon: 31.7899 },
  { id: "poltava", name: "połtawski", nameEn: "Poltava", distKm: 566.5, lat: 49.7136, lon: 33.8113 },
  { id: "sumy", name: "sumski", nameEn: "Sumy", distKm: 619.3, lat: 51.0948, lon: 34.1431 },
  { id: "kherson", name: "chersoński", nameEn: "Kherson", distKm: 698.7, lat: 46.6627, lon: 33.5774 },
  { id: "dnipropetrovsk", name: "dniepropetrowski", nameEn: "Dnipropetrovsk", distKm: 708.5, lat: 48.2758, lon: 34.8565 },
  { id: "kharkiv", name: "charkowski", nameEn: "Kharkiv", distKm: 768.6, lat: 49.6128, lon: 36.5144 },
  { id: "zaporizhzhia", name: "zaporoski", nameEn: "Zaporizhzhia", distKm: 811.9, lat: 47.2514, lon: 35.6995 },
  { id: "crimea", name: "Krym", nameEn: "Crimea", distKm: 827.4, lat: 45.333, lon: 34.3802 },
  { id: "sevastopol", name: "Sewastopol", nameEn: "Sevastopol", distKm: 932.5, lat: 44.5732, lon: 33.6527 },
  { id: "donetsk", name: "doniecki", nameEn: "Donetsk", distKm: 927.0, lat: 48.0473, lon: 37.6694 },
  { id: "luhansk", name: "ługański", nameEn: "Luhansk", distKm: 986.8, lat: 48.9859, lon: 39.0267 },
];

export const TYPE_SCORE = {
  ballistic: 3.0,
  mig31k: 2.6,
  cruise: 2.2,
  shahed: 1.4,
  drone: 1.1,
  aircraft: 0.8,
  helicopter: 0.6,
  unknown: 0.5,
};

export const LOC_QUALITY = { track: 1, region: 0.6, locality: 0.5 };
export const LIFECYCLE = { tracked: 1, fading: 0.7, lost: 0.4 };

const PL_BORDER = [
  [23.89, 50.37],
  [24.15, 50.82],
  [23.57, 51.55],
  [23.15, 52.08],
  [23.65, 52.45],
  [23.9, 53.2],
  [22.65, 49.18],
  [22.9, 49.85],
  [23.2, 50.1],
];

export function haversine(lon1, lat1, lon2, lat2) {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function distToPlBorder(lat, lon) {
  let min = Infinity;
  for (const [blon, blat] of PL_BORDER) {
    min = Math.min(min, haversine(lon, lat, blon, blat));
  }
  return min;
}

export function azimuthToPl(lat, lon) {
  const tLat = 50.8;
  const tLon = 24.0;
  const y = Math.sin(((tLon - lon) * Math.PI) / 180) * Math.cos((tLat * Math.PI) / 180);
  const x =
    Math.cos((lat * Math.PI) / 180) * Math.sin((tLat * Math.PI) / 180) -
    Math.sin((lat * Math.PI) / 180) * Math.cos((tLat * Math.PI) / 180) * Math.cos(((tLon - lon) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function timeWeight(ageMin) {
  if (ageMin <= 30) return 1;
  if (ageMin >= 60) return 0;
  return 1 - (ageMin - 30) / 30;
}

export function distFactor(km) {
  if (km >= 250) return 0;
  return 1.7 - (km / 250) * 1.6;
}

export function headingToPlFactor(course, lat, lon) {
  if (course == null || Number.isNaN(course)) return 0.7;
  const az = azimuthToPl(lat, lon);
  let diff = Math.abs(((course - az + 540) % 360) - 180);
  if (diff > 180) diff = 360 - diff;
  if (diff <= 50) return 1;
  if (diff >= 120) return 0.35;
  return 1 - ((diff - 50) / 70) * 0.65;
}

export function uaAlertWeight(distKm) {
  const w = 1 - (distKm * 0.92) / 320;
  return Math.max(0, w);
}

export function levelOf(points, rcbForce) {
  if (rcbForce) return "priority";
  if (points >= 4) return "priority";
  if (points >= 2) return "watch";
  return "info";
}

function emptyBreakdown() {
  return { neptun: 0, ua: 0, rcb: 0, media: 0, pazp: 0, other: 0 };
}

function cap(n, max) {
  return Math.min(n, max);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function scoreWorld(now, input) {
  const ageMin = (ts) => (now - ts) / 60000;
  const byId = Object.fromEntries(VOIV.map((v) => [v.id, v]));
  const buckets = Object.fromEntries(
    VOIV.map((v) => [
      v.id,
      { own: emptyBreakdown(), transfer: 0, transferredFrom: [], signals: [], rcbForce: false, neptunHits: [], uaHits: [] },
    ])
  );

  const objectsOut = [];
  const signals = [];

  for (const obj of input.objects) {
    const dist = distToPlBorder(obj.lat, obj.lon);
    const age = ageMin(obj.ts);
    const tw = timeWeight(age);
    const observation = dist > 250 || !!obj.area_only;
    const contrib = [];
    let raw = 0;
    if (!observation && tw > 0) {
      const fType = TYPE_SCORE[obj.type] ?? TYPE_SCORE.unknown;
      const fDist = distFactor(dist);
      const fConf = Math.max(0.1, Math.min(1, obj.confidence));
      const fConfirms = Math.min(1.4, 0.7 + 0.15 * (obj.confirmations ?? 1));
      const fHead = headingToPlFactor(obj.course, obj.lat, obj.lon);
      const fLife = LIFECYCLE[obj.lifecycle] ?? 1;
      const fLoc = LOC_QUALITY[obj.loc_quality] ?? 1;
      raw = fType * Math.sqrt(obj.count ?? 1) * fDist * fConf * fConfirms * fHead * fLife * fLoc * tw;

      if (obj.confidence >= 0.75 && (obj.confirmations ?? 0) >= 2 && obj.eta_min != null) {
        if (obj.eta_min <= 5) raw = Math.max(raw, 4);
        else if (obj.eta_min <= 10) raw = Math.max(raw, 2);
      }
    }
    for (const v of VOIV) {
      if (observation || raw <= 0) {
        contrib.push({ id: v.id, points: 0 });
        continue;
      }
      const dV = haversine(obj.lon, obj.lat, v.lon, v.lat);
      const voivF = Math.max(0.12, Math.min(1, 1.15 - dV / 420));
      const pts = raw * voivF;
      contrib.push({ id: v.id, points: round2(pts) });
      buckets[v.id].own.neptun += pts;
      if (pts > 0.05) {
        buckets[v.id].neptunHits.push({
          type: obj.type,
          n: obj.count || 1,
          dist,
          toward: headingToPlFactor(obj.course, obj.lat, obj.lon) >= 1,
        });
      }
    }
    const az = azimuthToPl(obj.lat, obj.lon);
    objectsOut.push({
      ...obj,
      dist_pl_km: round1(dist),
      azimuth_pl: round1((az + 360) % 360),
      observation,
      points_contrib: contrib.filter((c) => c.points > 0.01),
    });
    if (!observation && raw > 0.05) {
      const top = contrib.sort((a, b) => b.points - a.points).slice(0, 4);
      signals.push({
        id: `sig-${obj.id}`,
        source: "neptun",
        title: `${labelType(obj.type)} · conf ${(obj.confidence * 100).toFixed(0)}% · ±${obj.unc_km} km`,
        url: null,
        ts: obj.ts,
        weight: tw,
        points: round2(raw),
        voivodeships: top.map((t) => t.id),
      });
    }
  }

  for (const alert of input.ua_alerts) {
    if (!alert.active) continue;
    const oblast = UA_OBLASTS.find((o) => o.id === alert.oblast);
    if (!oblast) continue;
    const w = uaAlertWeight(oblast.distKm);
    const tw = 1;
    const pts = w * tw;
    if (pts <= 0) continue;
    for (const v of VOIV) {
      const dV = haversine(oblast.lon, oblast.lat, v.lon, v.lat);
      const near = dV < 220 ? 1 : EAST_IDS.has(v.id) ? 0.4 : 0.1;
      buckets[v.id].own.ua += pts * near;
      if (pts * near > 0.04) buckets[v.id].uaHits.push(oblast);
    }
    signals.push({
      id: `sig-ua-${alert.oblast}`,
      source: "ua",
      title: `Alarm powietrzny UA · ${oblast.name}`,
      url: "https://alerts.in.ua",
      ts: alert.since,
      weight: tw,
      points: round2(pts),
      voivodeships: VOIV.filter((v) => EAST_IDS.has(v.id)).map((v) => v.id),
    });
  }

  if (input.rcb?.active) {
    const tw = timeWeight(ageMin(input.rcb.ts));
    const pts = 2 * tw;
    const targets = input.rcb.voivodeships?.length ? input.rcb.voivodeships : VOIV.map((v) => v.id);
    if (tw > 0) {
      for (const id of targets) {
        if (!buckets[id]) continue;
        buckets[id].own.rcb += pts;
        buckets[id].rcbForce = true;
      }
      signals.push({
        id: `sig-rcb-${input.rcb.ts}`,
        source: "rcb",
        title: input.rcb.title || "Alert RCB — zagrożenie z powietrza",
        url: input.rcb.url || "https://www.gov.pl/web/rcb",
        ts: input.rcb.ts,
        weight: tw,
        points: round2(pts),
        voivodeships: targets,
      });
    }
  }

  for (const item of input.rss) {
    const age = ageMin(item.ts);
    const tw = timeWeight(age);
    if (tw <= 0 || item.score <= 0) continue;
    const pts = Math.min(1, item.score) * tw;
    const targets = item.voivodeships?.length ? item.voivodeships : ["lubelskie", "podkarpackie"];
    for (const id of targets) {
      if (buckets[id]) buckets[id].own.media += pts;
    }
    signals.push({
      id: item.id,
      source: "rss",
      title: item.title,
      url: item.url,
      ts: item.ts,
      weight: tw,
      points: round2(pts),
      voivodeships: targets,
    });
  }

  for (const zone of input.zones) {
    const ageDays = (now - zone.created_ts) / 86400000;
    const scoresType = ["D", "R", "NPZ", "ADHOC"].includes(zone.type);
    zone.scores = false;
    zone.reason =
      "TSA/TRA/ATZ/PJE/GLD/CLN/BSP = 0 pkt. Punktują tylko rzadkie D/R/NPZ/ADHOC od ziemi, nowe <7 dni, wschód/północ.";
    if (!scoresType || ageDays >= 7 || zone.origin !== "ground") continue;
    const targets = zone.voivodeships || [];
    const isNorth = targets.some((id) => NORTH_IDS.has(id));
    const isEast = targets.some((id) => EAST_IDS.has(id));
    if (!isNorth && !isEast) continue;
    const pts = isNorth && !isEast ? 1 : 0.5;
    zone.scores = true;
    zone.reason = isNorth
      ? "Strefa D/R/NPZ/ADHOC od ziemi, <7 dni, północ — NEPTUN tam nic nie daje, +1 (cap 1)."
      : "Strefa D/R/NPZ/ADHOC od ziemi, <7 dni, wschód — +0.5 (cap 1).";
    for (const id of targets) {
      if (buckets[id]) buckets[id].own.pazp += pts;
    }
    signals.push({
      id: `sig-zone-${zone.id}`,
      source: "pazp",
      title: `${zone.type} ${zone.code}`,
      url: null,
      ts: zone.created_ts,
      weight: 1,
      points: pts,
      voivodeships: targets,
    });
  }

  for (const b of input.baltic || []) {
    const age = ageMin(b.ts);
    if (age > 30) continue;
    const tw = 1;
    const pts = b.kind === "alarm" ? b.points ?? 0.2 : b.points ?? 0.6;
    for (const v of VOIV) {
      let m = 0;
      if (BALTIC_FULL.has(v.id)) m = 1;
      else if (v.id === "zachodniopomorskie") m = 0.5;
      else continue;
      buckets[v.id].own.other += pts * tw * m;
    }
    signals.push({
      id: b.id,
      source: "baltic",
      title: b.title,
      url: b.url,
      ts: b.ts,
      weight: tw,
      points: pts,
      voivodeships: [...BALTIC_FULL, "zachodniopomorskie"],
    });
  }

  for (const n of input.nato || []) {
    const tw = timeWeight(ageMin(n.ts));
    if (tw <= 0) continue;
    const pts = 0.3 * tw;
    for (const v of VOIV) buckets[v.id].own.other += pts;
    signals.push({
      id: n.id,
      source: "nato",
      title: n.title,
      url: n.url,
      ts: n.ts,
      weight: tw,
      points: round2(pts),
      voivodeships: VOIV.map((v) => v.id),
    });
  }

  for (const v of VOIV) {
    const b = buckets[v.id].own;
    b.neptun = cap(b.neptun, 8);
    b.ua = cap(b.ua, 1);
    b.rcb = cap(b.rcb, 2);
    b.media = cap(b.media, 1);
    b.pazp = cap(b.pazp, 1);
    b.other = cap(b.other, 0.6);
  }

  for (const v of VOIV) {
    const own = buckets[v.id].own;
    const ownNoRcb = own.neptun + own.ua + own.media + own.pazp + own.other;
    if (ownNoRcb < 2) continue;
    const share = Math.max(0.1, ownNoRcb * 0.4);
    for (const nid of v.neighbors) {
      buckets[nid].transfer += share;
      buckets[nid].transferredFrom.push({ id: v.id, name: v.name, points: round2(share) });
    }
  }

  const voivodeships = VOIV.map((v) => {
    const b = buckets[v.id];
    const breakdown = {
      neptun: round2(b.own.neptun),
      ua: round2(b.own.ua),
      rcb: round2(b.own.rcb),
      media: round2(b.own.media),
      pazp: round2(b.own.pazp),
      other: round2(b.own.other),
    };
    const ownSum = Object.values(breakdown).reduce((a, x) => a + x, 0);
    const transfer = round2(b.transfer);
    const points = round2(ownSum + transfer);
    const ownForLevel = ownSum;
    const paint =
      ownForLevel >= 4 ? "priority" : ownForLevel >= 2 ? "watch" : transfer >= 0.1 ? "transfer" : "info";
    const level = levelOf(ownForLevel, b.rcbForce);
    const why = whyLines(b, v);
    return {
      id: v.id,
      name: v.name,
      nameEn: v.nameEn,
      eastRank: v.eastRank,
      points,
      own: round2(ownSum),
      transfer,
      level,
      paint,
      breakdown,
      transferred_from: b.transferredFrom,
      whyPl: why.pl,
      whyEn: why.en,
    };
  });

  const objectContribByVoiv = {};
  for (const obj of objectsOut) {
    for (const c of obj.points_contrib) {
      (objectContribByVoiv[c.id] ??= []).push({ object: obj.id, points: c.points });
    }
  }

  return { voivodeships, objects: objectsOut, signals, objectContribByVoiv };
}

export function labelType(type) {
  return (
    {
      shahed: "Shahed",
      drone: "dron / BpSP",
      cruise: "pocisk manewrujący",
      ballistic: "balistyczny",
      aircraft: "samolot",
      helicopter: "śmigłowiec",
      mig31k: "MiG-31K",
      unknown: "nieznany",
    }[type] || type
  );
}

export function labelTypeEn(type) {
  return (
    {
      shahed: "Shahed",
      drone: "drone / UAS",
      cruise: "cruise missile",
      ballistic: "ballistic",
      aircraft: "aircraft",
      helicopter: "helicopter",
      mig31k: "MiG-31K",
      unknown: "unknown",
    }[type] || type
  );
}

function whyLines(b, v) {
  const pl = [];
  const en = [];
  const hits = b.neptunHits || [];
  if (hits.length) {
    const byType = new Map();
    let minDist = Infinity;
    let toward = false;
    for (const h of hits) {
      byType.set(h.type, (byType.get(h.type) || 0) + (h.n || 1));
      if (h.dist < minDist) minDist = h.dist;
      if (h.toward) toward = true;
    }
    const plBits = [...byType.entries()].map(([type, n]) => `${n}× ${labelType(type)}`);
    const enBits = [...byType.entries()].map(([type, n]) => `${n}× ${labelTypeEn(type)}`);
    const km = `~${Math.round(minDist)} km`;
    pl.push(`${plBits.join(", ")} ${km}${toward ? ", kurs na PL" : ""}`);
    en.push(`${enBits.join(", ")} ${km}${toward ? ", heading toward PL" : ""}`);
  }
  const uaHits = b.uaHits || [];
  if (b.own.ua > 0.04 && uaHits.length) {
    const seen = [];
    for (const o of uaHits) {
      if (!seen.some((x) => x.id === o.id)) seen.push(o);
    }
    const top = seen.slice(0, 2);
    pl.push(`alarm ${top.map((o) => o.name).join(", ")}`);
    en.push(`alert ${top.map((o) => o.nameEn).join(", ")}`);
  }
  if (b.own.rcb > 0) {
    pl.push("Alert RCB");
    en.push("RCB Alert");
  }
  if (b.own.media > 0.04) {
    pl.push("wzmianka RSS");
    en.push("RSS mention");
  }
  if (b.own.pazp > 0.04) {
    pl.push("strefa PAŻP");
    en.push("PAŻP zone");
  }
  if (!pl.length && b.transferredFrom[0]) {
    pl.push(`transfer z ${b.transferredFrom[0].name}`);
    en.push(`transfer from ${b.transferredFrom[0].name}`);
  }
  return { pl: pl.join(" · "), en: en.join(" · ") };
}

const objectTrails = new Map();
const TRAIL_KEEP_MS = 15 * 60 * 1000;

export function rememberTrails(objects, now = Date.now()) {
  const live = new Set(objects.map((o) => String(o.id)));
  for (const o of objects) {
    const id = String(o.id);
    const prev = objectTrails.get(id) || [];
    const last = prev[prev.length - 1];
    if (!last || haversine(last.lon, last.lat, o.lon, o.lat) >= 0.3 || now - last.ts >= 50_000) {
      prev.push({ lat: o.lat, lon: o.lon, ts: now });
    }
    objectTrails.set(
      id,
      prev.filter((p) => now - p.ts <= TRAIL_KEEP_MS)
    );
  }
  for (const id of [...objectTrails.keys()]) {
    if (!live.has(id)) objectTrails.delete(id);
  }
}

export function trailOf(id) {
  return objectTrails.get(String(id)) || [];
}

function polyRect(lon, lat, dlon, dlat) {
  return [
    [
      [lon - dlon, lat - dlat],
      [lon + dlon, lat - dlat],
      [lon + dlon, lat + dlat],
      [lon - dlon, lat + dlat],
      [lon - dlon, lat - dlat],
    ],
  ];
}

export const CAMERAS = [
  { id: "cam-przemysl", name: "Przemyśl", lat: 49.782, lon: 22.769 },
  { id: "cam-hrebenne", name: "Hrebenne", lat: 50.267, lon: 23.983 },
  { id: "cam-chelm", name: "Chełm", lat: 51.143, lon: 23.471 },
  { id: "cam-wlodawa", name: "Włodawa", lat: 51.55, lon: 23.552 },
  { id: "cam-terespol", name: "Terespol", lat: 52.076, lon: 23.616 },
  { id: "cam-hajnowka", name: "Hajnówka", lat: 52.743, lon: 23.581 },
  { id: "cam-rzeszow", name: "Rzeszów", lat: 50.041, lon: 21.999 },
  { id: "cam-lublin", name: "Lublin", lat: 51.246, lon: 22.568 },
];

function sourceStatus(id, ok, ageS, message, records) {
  let diode = "ok";
  if (!ok) diode = "dead";
  else if (ageS > 900) diode = "dead";
  else if (ageS > 120) diode = "late";
  return { id, ok, age_s: ageS, message, records, diode };
}

let liveObjects = null;

export function resetLive() {
  liveObjects = null;
}

export function buildInput(now, { history = false, tOffsetMin = 0 } = {}) {
  const t = now - tOffsetMin * 60000;
  if (!liveObjects) {
    liveObjects = [
      {
        id: "npt-7f21",
        type: "shahed",
        lat: 49.7136,
        lon: 33.8113,
        unc_km: 18,
        course: 98,
        speed: 165,
        eta_min: null,
        confidence: 0.41,
        confirmations: 1,
        loc_quality: "region",
        lifecycle: "tracked",
        count: 1,
        ts: t - 8 * 60000,
        title: "Shahed · obwód połtawski",
      },
      {
        id: "npt-2c90",
        type: "unknown",
        lat: 48.9265,
        lon: 28.6921,
        unc_km: 32,
        course: 112,
        speed: 90,
        eta_min: null,
        confidence: 0.27,
        confirmations: 1,
        loc_quality: "locality",
        lifecycle: "fading",
        count: 1,
        ts: t - 22 * 60000,
        title: "trop niepewny · obwód winnicki",
      },
    ];
  }

  const rss = [];
  const histAgeMin = tOffsetMin;
  if (history && histAgeMin > 280 && histAgeMin < 340) {
    rss.push({
      id: "rss-hist-1",
      title: "Wzmianka lokalna: odgłosy eksplozji po stronie UA (Chełm)",
      url: "https://example.invalid/lokalne",
      ts: t - 5 * 60000,
      score: 0.5,
      voivodeships: ["lubelskie"],
    });
  }

  return {
    objects: liveObjects.map((o) => ({ ...o })),
    ua_alerts: [],
    rcb: { active: false, ts: t, title: "", voivodeships: [] },
    rss,
    zones: [
      {
        id: "TSA-EPRZ-04",
        type: "TSA",
        code: "TSA04",
        from: "06:00 UTC",
        to: "22:00 UTC",
        origin: "air",
        created_ts: t - 20 * 86400000,
        voivodeships: ["podkarpackie"],
        geometry: { type: "Polygon", coordinates: polyRect(22.0, 50.04, 0.28, 0.16) },
      },
    ],
    baltic: [],
    nato: [],
    adsb: [
      {
        id: "adsb-3a1",
        callsign: "PLF101",
        type: "C-295",
        mil: true,
        lat: 51.28,
        lon: 22.62,
        heading: 176,
        alt_ft: 11800,
        speed_kt: 240,
        ts: t - 25000,
      },
    ],
  };
}

export function tickLive(dtMs) {
  if (!liveObjects) return;
  for (const o of liveObjects) {
    const dtH = dtMs / 3600000;
    const km = (o.speed || 0) * dtH;
    const rad = ((o.course || 90) * Math.PI) / 180;
    o.lat += (km / 111) * Math.cos(rad);
    o.lon += (km / (111 * Math.cos((o.lat * Math.PI) / 180))) * Math.sin(rad);
    o.lat = Math.min(52.2, Math.max(46.5, o.lat));
    o.lon = Math.min(38.5, Math.max(28.2, o.lon));
    if (distToPlBorder(o.lat, o.lon) < 260) {
      o.lon += 0.08;
    }
  }
}

export function buildState(now = Date.now(), input, sourceRows) {
  input = {
    objects: input?.objects || [],
    ua_alerts: input?.ua_alerts || [],
    rcb: input?.rcb || { active: false, ts: now, title: "", voivodeships: [] },
    rss: input?.rss || [],
    zones: input?.zones || [],
    baltic: input?.baltic || [],
    nato: input?.nato || [],
    adsb: input?.adsb || [],
  };
  const scored = scoreWorld(now, input);
  rememberTrails(scored.objects, now);
  const sources = sourceRows || [
    sourceStatus("neptun", false, 9999, "brak wejścia", 0),
    sourceStatus("ua", false, 9999, "brak wejścia", 0),
    sourceStatus("adsb", false, 9999, "brak wejścia", 0),
    sourceStatus("rss", false, 9999, "brak wejścia", 0),
    sourceStatus("rcb", false, 9999, "brak wejścia", 0),
    { id: "pazp", ok: true, age_s: 0, message: "brak publicznego AUP w tym cyklu — warstwa pusta", records: 0, diode: "late" },
  ];

  return {
    generated_at: new Date(now).toISOString(),
    demo: false,
    sources,
    voivodeships: scored.voivodeships,
    objects: scored.objects.map((o) => ({
      id: o.id,
      type: o.type,
      title: o.title,
      lat: o.lat,
      lon: o.lon,
      unc_km: o.unc_km,
      course: o.course,
      speed: o.speed,
      eta_min: o.eta_min,
      confidence: o.confidence,
      confirmations: o.confirmations,
      loc_quality: o.loc_quality,
      lifecycle: o.lifecycle,
      ts: new Date(o.ts).toISOString(),
      dist_pl_km: o.dist_pl_km,
      azimuth_pl: o.azimuth_pl,
      observation: o.observation,
      points_contrib: o.points_contrib,
      trail: trailOf(o.id).map((p) => ({ lat: p.lat, lon: p.lon, ts: p.ts })),
    })),
    adsb: input.adsb || [],
    zones: (input.zones || []).map((z) => ({
      id: z.id,
      type: z.type,
      code: z.code,
      from: z.from,
      to: z.to,
      scores: z.scores,
      reason: z.reason,
      voivodeships: z.voivodeships,
      geometry: z.geometry,
    })),
    ua_alerts: UA_OBLASTS.map((o) => {
      const a = (input.ua_alerts || []).find((x) => x.oblast === o.id);
      return {
        oblast: o.id,
        name: o.name,
        nameEn: o.nameEn,
        active: !!a?.active,
        since: a?.since ? new Date(a.since).toISOString() : null,
        dist_km: o.distKm,
      };
    }),
    signals: scored.signals.map((s) => ({
      ...s,
      ts: new Date(s.ts).toISOString(),
    })),
    cameras: CAMERAS.map((c) => ({ ...c, status: "no_stream", note: "punkt obserwacji — brak żywego strumienia" })),
  };
}

export function emptyHistory(hours = 12) {
  const n = hours * 60;
  const t0 = Date.now() - hours * 3600000;
  return {
    generated_at: new Date().toISOString(),
    hours,
    step_s: 60,
    t0: new Date(t0).toISOString(),
    n,
    max_pl: new Array(n).fill(0),
    voivodeships: Object.fromEntries(VOIV.map((v) => [v.id, new Array(n).fill(0)])),
    objects: [],
    signals: [],
  };
}

export function stampHistory(bundle, state) {
  const t0 = new Date(bundle.t0).getTime();
  let idx = Math.floor((Date.now() - t0) / 1000 / bundle.step_s);
  if (idx >= bundle.n) {
    const shift = idx - bundle.n + 1;
    bundle.max_pl.splice(0, shift);
    while (bundle.max_pl.length < bundle.n) bundle.max_pl.push(0);
    for (const id of Object.keys(bundle.voivodeships)) {
      bundle.voivodeships[id].splice(0, shift);
      while (bundle.voivodeships[id].length < bundle.n) bundle.voivodeships[id].push(0);
    }
    bundle.t0 = new Date(t0 + shift * bundle.step_s * 1000).toISOString();
    idx = bundle.n - 1;
  }
  if (idx < 0) idx = 0;
  let mx = 0;
  for (const v of state.voivodeships) {
    bundle.voivodeships[v.id][idx] = v.points;
    if (v.points > mx) mx = v.points;
  }
  bundle.max_pl[idx] = mx;
  bundle.generated_at = state.generated_at;
  const prev = Object.fromEntries((bundle.objects || []).map((o) => [o.id, o]));
  bundle.objects = (state.objects || []).map((o) => {
    const samples = [...(prev[o.id]?.samples || [])];
    samples.push({ t: idx, lat: o.lat, lon: o.lon });
    return { id: o.id, type: o.type, samples: samples.filter((s) => s.t >= idx - 15) };
  });
  bundle.signals = state.signals || [];
  return bundle;
}
