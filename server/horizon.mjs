/** Horizon adapter: sample fixtures + live fusion state → content-model shapes. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "brand/04-ux/sample-data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
}

export function loadFixtures() {
  return {
    events: readJson("events.json").events,
    signals: readJson("signals.json").signals,
    sources: readJson("sources.json").sources,
    status: readJson("status.json"),
    areas: readJson("areas.json").areas,
  };
}

function mapFusionLevel(v) {
  if (v.level === "priority" || v.paint === "priority") return "alarm";
  if (v.level === "watch") return v.breakdown?.rcb > 0 || (v.own ?? 0) >= 2 ? "ostrzezenie" : "obserwacja";
  if (v.paint === "transfer") return "obserwacja";
  return "cisza";
}

function sourceFromFusion(src) {
  const map = {
    rcb: { id: "rcb", kind: "official", name: "RCB — Alert RCB", short: "RCB" },
    rss: { id: "imgw", kind: "official", name: "IMGW — ostrzeżenia meteo", short: "IMGW" },
    adsb: { id: "sdr", kind: "radio", name: "SDR / ADS-B", short: "SDR" },
    neptun: { id: "sdr", kind: "radio", name: "SDR / ADS-B", short: "SDR" },
    ua: { id: "sdr", kind: "radio", name: "SDR / ADS-B", short: "SDR" },
    pazp: { id: "psp", kind: "official", name: "PSP — komunikaty", short: "PSP" },
  };
  const base = map[src.id] || { id: src.id, kind: "radio", name: src.id, short: src.id };
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
    attribution: "",
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
      if (v.breakdown?.neptun) sources.push("sdr");
      if (v.breakdown?.media) sources.push("imgw");
      if (v.breakdown?.pazp) sources.push("psp");
      if (!sources.length) sources.push("sdr");
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
                "Telefon w trybie oszczędzania energii. Zorya powiadomi o odwołaniu.",
              ]
            : [],
        },
        signals: [],
        report_count: 0,
      };
    });

  const signals = (state.signals || []).slice(0, 20).map((sg) => ({
    id: sg.id,
    source: sg.source === "rcb" ? "rcb" : sg.source === "rss" ? "imgw" : "sdr",
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

  const fusionSources = (state.sources || []).map(sourceFromFusion);
  const seen = new Set();
  const sources = [];
  for (const src of fusionSources) {
    if (seen.has(src.id)) continue;
    seen.add(src.id);
    sources.push(src);
  }
  while (sources.length < 6) {
    const extras = [
      { id: "psp", kind: "official", name: "PSP — komunikaty", short: "PSP", health: "disabled", enabled: false },
      { id: "syreny", kind: "sensor", name: "Syreny — czujniki akustyczne", short: "syreny", health: "disabled", enabled: false },
      { id: "zgloszenia", kind: "reports", name: "Zgłoszenia użytkowników", short: "zgłoszenia", health: "fresh", enabled: true },
      { id: "radio_ews", kind: "radio", name: "Radio publiczne (RDS/EWS)", short: "radio", health: "disabled", enabled: false },
    ];
    for (const e of extras) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        sources.push({
          ...e,
          description: "",
          freshness_s: 900,
          locked: false,
          last_update: null,
          attribution: "",
        });
      }
    }
    break;
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

const reports = [];

export function addReport(body) {
  const id = `r-${Date.now().toString(36)}`;
  const withdraw_until = new Date(Date.now() + 10 * 60_000).toISOString();
  reports.push({ id, ...body, state: "sent", withdraw_until });
  return { id, withdraw_until };
}

export function withdrawReport(id) {
  const r = reports.find((x) => x.id === id);
  if (!r) return false;
  if (new Date(r.withdraw_until) < new Date()) return false;
  r.state = "withdrawn";
  return true;
}
