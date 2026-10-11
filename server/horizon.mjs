/** Horizon adapter: sample fixtures + live fusion state → content-model shapes. */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "brand/04-ux/sample-data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
}

let fixtures = null;

/** Sample data never changes at runtime: read it once, not on every request. */
export function loadFixtures() {
  fixtures ??= {
    events: readJson("events.json").events,
    signals: readJson("signals.json").signals,
    sources: readJson("sources.json").sources,
    status: readJson("status.json"),
    areas: readJson("areas.json").areas,
  };
  return fixtures;
}

function mapFusionLevel(v) {
  if (v.level === "priority" || v.paint === "priority") return "alarm";
  if (v.level === "watch") return v.breakdown?.rcb > 0 || (v.own ?? 0) >= 2 ? "ostrzezenie" : "obserwacja";
  if (v.paint === "transfer") return "obserwacja";
  return "cisza";
}

/** Truthful labels for the live sources. PAŻP has no public feed, so it is not listed as a source. */
const SOURCE_META = {
  neptun: {
    id: "neptun",
    kind: "osint",
    name: "NEPTUN — zagrożenia nad Ukrainą (OSINT)",
    short: "NEPTUN",
    attribution: "neptun.in.ua — śledzenie dronów, pocisków i lotnictwa nad Ukrainą na podstawie OSINT. To nie są dane radarowe; pozycje są przybliżone.",
  },
  ua: {
    id: "ua",
    kind: "osint",
    name: "Alarmy powietrzne w Ukrainie",
    short: "alarmy UA",
    attribution: "Obwody Ukrainy z aktywnym alarmem powietrznym, pobierane przez neptun.in.ua.",
  },
  adsb: {
    id: "adsb",
    kind: "radio",
    name: "ADS-B — ruch lotniczy (adsb.lol)",
    short: "ADS-B",
    attribution: "adsb.lol — otwarte dane ADS-B. Tylko statki powietrzne, które same nadają swoją pozycję.",
  },
  rss: {
    id: "media",
    kind: "media",
    name: "Media — RMF24 i PAP (RSS)",
    short: "media",
    attribution: "Kanały RSS rmf24.pl i pap.pl oraz komunikaty RSO, filtrowane pod kątem zagrożeń z powietrza. Same nie podnoszą poziomu.",
  },
  rcb: {
    id: "rcb",
    kind: "official",
    name: "RSO / Alert RCB (komunikaty.tvp.pl)",
    short: "RSO/RCB",
    attribution: "Regionalny System Ostrzegania i Alert RCB, komunikaty.tvp.pl — informacja publiczna. Treść oryginalna zawsze w źródle.",
  },
};

function sourceFromFusion(src) {
  const base = SOURCE_META[src.id];
  if (!base) return null;
  const health = src.diode === "ok" ? "fresh" : src.diode === "off" ? "disabled" : src.diode === "dead" ? "down" : "stale";
  const last = new Date(Date.now() - (src.age_s || 0) * 1000).toISOString();
  return {
    ...base,
    description: src.message || "",
    freshness_s: 900,
    enabled: src.diode !== "off",
    locked: src.id === "rcb",
    health,
    last_update: last,
  };
}

export function horizonFromFusion(state, areaId) {
  const voiv = state.voivodeships || [];
  const selected = areaId ? voiv.find((v) => v.id === areaId) : voiv.reduce((a, b) => {
    const order = { cisza: 0, obserwacja: 1, ostrzezenie: 2, alarm: 3, odwolanie: 4 };
    return (order[mapFusionLevel(b)] || 0) > (order[mapFusionLevel(a)] || 0) ? b : a;
  }, voiv[0]);
  const level = selected ? mapFusionLevel(selected) : "cisza";
  const area = selected
    ? { id: selected.id, name: selected.name, kind: "wojewodztwo" }
    : { id: "pl", name: "Polska", kind: "wojewodztwo" };
  const events = voiv
    .filter((v) => mapFusionLevel(v) !== "cisza")
    .filter((v) => !areaId || v.id === areaId || mapFusionLevel(v) === "alarm")
    .map((v, i) => {
      const lv = mapFusionLevel(v);
      const sources = [];
      if (v.breakdown?.rcb) sources.push("rcb");
      if (v.breakdown?.neptun) sources.push("neptun");
      if (v.breakdown?.ua) sources.push("ua");
      if (v.breakdown?.media) sources.push("media");
      if (!sources.length) sources.push("neptun");
      return {
        id: `live-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(i + 1).padStart(3, "0")}`.replace(
          /(\d{4})(\d{2})(\d{2})/,
          "$1-$2$3"
        ),
        level: lv,
        confidence: sources.length > 1 ? "potwierdzone" : "pojedynczy",
        confidence_reason: v.whyPl || "",
        kind: lv === "alarm" ? "air" : "other",
        title: v.whyPl || v.name,
        areas: [{ id: v.id, name: v.name, kind: "wojewodztwo" }],
        started_at: state.generated_at,
        updated_at: state.generated_at,
        valid_until: null,
        state: "active",
        cancelled_at: null,
        sources,
        instructions: {
          official: "",
          steps: lv === "alarm"
            ? [
                "Wejdź do budynku, najlepiej do piwnicy albo pomieszczenia bez okien.",
                "Trzymaj się z dala od okien. Nie wychodź, dopóki nie zobaczysz odwołania.",
                "Sprawdzaj Alert RCB i RSO — Zorya nie zastępuje oficjalnych komunikatów.",
              ]
            : [],
        },
        signals: [],
        report_count: 0,
      };
    });

  const signals = (state.signals || []).slice(0, 20).map((sg) => ({
    id: sg.id,
    source: sg.source === "rss" ? "media" : ["rcb", "neptun", "ua", "adsb"].includes(sg.source) ? sg.source : "neptun",
    kind: "other",
    observed_at: sg.ts,
    received_at: sg.ts,
    areas: (sg.voivodeships || []).map((id) => {
      const v = voiv.find((x) => x.id === id);
      return { id, name: v?.name || id, kind: "wojewodztwo" };
    }),
    text: sg.title,
    meta: `${sg.source} · ${sg.points ?? ""}`,
    event_id: null,
    counted: false,
  }));

  const fusionSources = (state.sources || []).map(sourceFromFusion).filter(Boolean);
  const seen = new Set();
  const sources = [];
  for (const src of fusionSources) {
    if (seen.has(src.id)) continue;
    seen.add(src.id);
    sources.push(src);
  }

  const activeSources = sources.filter((s) => s.enabled && s.health === "fresh").length;
  return {
    status: {
      area,
      level,
      since: state.generated_at,
      active_events: events.length,
      sources_active: activeSources,
      sources_total: sources.length,
      data_as_of: state.generated_at,
      stale: false,
    },
    events,
    signals,
    sources,
    sample: false,
  };
}

export function statusFromFusion(state) {
  const h = horizonFromFusion(state, null);
  return {
    level_max: h.status.level,
    sources: h.sources,
    data_as_of: h.status.data_as_of,
    version: "0.1",
    sample: false,
    area_status: [h.status],
  };
}

const REPORT_KINDS = new Set(["syrena", "huk", "dron_samolot", "dym_pozar", "brak_pradu", "inne"]);
const MAX_REPORTS = 2000;
const REPORT_KEEP_MS = 24 * 3600_000;
const WITHDRAW_MS = 10 * 60_000;
/** Rough box around Poland (with a margin): reports from elsewhere are not about Polish skies. */
const REPORT_BOX = { minLat: 48.5, maxLat: 55.5, minLon: 13.5, maxLon: 24.8 };

const reports = [];

/** 500 m grid, so a stored report never carries a precise home address (README promise, enforced here). */
function round500(lat, lon) {
  const dLat = 500 / 111_320;
  const dLon = 500 / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: Math.round(lat / dLat) * dLat, lon: Math.round(lon / dLon) * dLon };
}

/** Whitelist and clamp a report body. Throws with a short Polish reason on bad input. */
export function cleanReport(body) {
  const kind = String(body?.kind || "");
  if (!REPORT_KINDS.has(kind)) throw new Error("nieznany rodzaj zgłoszenia");
  const lat = Number(body?.location?.lat);
  const lon = Number(body?.location?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("brak położenia");
  if (lat < REPORT_BOX.minLat || lat > REPORT_BOX.maxLat || lon < REPORT_BOX.minLon || lon > REPORT_BOX.maxLon) {
    throw new Error("położenie poza Polską");
  }
  const seen = Date.parse(body?.observed_at);
  const now = Date.now();
  // A sighting from the future or older than a day is not a live report.
  const observed = Number.isFinite(seen) && seen <= now + 5 * 60_000 && seen >= now - 24 * 3600_000 ? seen : now;
  const p = round500(lat, lon);
  return {
    kind,
    observed_at: new Date(observed).toISOString(),
    location: { lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lon * 1e5) / 1e5, rounded_m: 500 },
    note: String(body?.note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500),
    area_id: body?.area_id == null ? null : String(body.area_id).slice(0, 64),
  };
}

function pruneReports(now) {
  while (reports.length && (reports.length > MAX_REPORTS || now - reports[0].received_at > REPORT_KEEP_MS)) reports.shift();
}

/** Stores a cleaned report. The id is random (128 bit): it is the only key that can withdraw it. */
export function addReport(body) {
  const clean = cleanReport(body);
  const now = Date.now();
  pruneReports(now);
  const id = `r-${crypto.randomUUID()}`;
  const withdraw_until = new Date(now + WITHDRAW_MS).toISOString();
  reports.push({ ...clean, id, state: "sent", received_at: now, withdraw_until });
  return { id, withdraw_until, report: clean };
}

export function withdrawReport(id) {
  const r = reports.find((x) => x.id === id);
  if (!r) return false;
  if (new Date(r.withdraw_until) < new Date()) return false;
  r.state = "withdrawn";
  return true;
}
