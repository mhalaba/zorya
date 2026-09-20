import eventsFile from "./fixtures/events.json";
import signalsFile from "./fixtures/signals.json";
import sourcesFile from "./fixtures/sources.json";
import statusFile from "./fixtures/status.json";
import areasFile from "./fixtures/areas.json";
import type { AreaRef, AreaStatus, EventItem, HorizonPayload, Level, Signal, Source, StatusPayload } from "./model";
import { SOURCE_KIND } from "./model";
import { fixtureParam } from "./nav";
import { useStore } from "./store";

const eventsAll = (eventsFile as { events: EventItem[] }).events;
const signalsAll = (signalsFile as { signals: Signal[] }).signals;
const sourcesAll = (sourcesFile as { sources: Source[] }).sources;
const areasAll = (areasFile as { areas: AreaRef[] }).areas;
const statusAll = statusFile as StatusPayload & { area_status: AreaStatus[] };

export const SAMPLE_AREAS = areasAll;
export const SAMPLE_SOURCES = sourcesAll;

export type Scenario =
  | "alarm"
  | "obserwacja"
  | "ostrzezenie"
  | "odwolanie"
  | "cisza"
  | "stale"
  | "offline";

export function activeScenario(): Scenario | null {
  const v = fixtureParam();
  if (v === null) return null;
  if (v === "1" || v === "true" || v === "alarm") return "alarm";
  if (v === "obserwacja" || v === "ostrzezenie" || v === "odwolanie" || v === "cisza" || v === "stale" || v === "offline") {
    return v;
  }
  return "alarm";
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function fixtureHorizon(areaId: string | null, scenario: Scenario = "alarm"): HorizonPayload {
  const events = clone(eventsAll);
  const signals = clone(signalsAll);
  const sources = clone(sourcesAll);
  const areas = clone(areasAll);
  const area = areas.find((a) => a.id === areaId) ?? areas[0];

  let outEvents = events;
  let outSignals = signals.filter((s) => !s.event_id);
  let level: Level = "alarm";
  let since = "2026-09-20T05:37:04+02:00";
  let stale = false;
  let dataAsOf = "2026-09-20T05:41:00+02:00";
  let active = 1;

  if (scenario === "obserwacja") {
    outEvents = events.filter((e) => e.id === "2026-0920-016");
    outSignals = signals.filter((s) => !s.event_id);
    level = "obserwacja";
    since = "2026-09-20T04:52:00+02:00";
    dataAsOf = "2026-09-20T05:40:00+02:00";
  } else if (scenario === "ostrzezenie") {
    outEvents = events
      .filter((e) => e.id === "2026-0920-016")
      .map((e) => ({ ...e, level: "ostrzezenie" as const, confidence: "prawdopodobne" as const }));
    outSignals = signals.filter((s) => !s.event_id);
    level = "ostrzezenie";
    since = "2026-09-20T04:52:00+02:00";
  } else if (scenario === "odwolanie") {
    outEvents = events
      .filter((e) => e.id === "2026-0920-017")
      .map((e) => ({
        ...e,
        level: "odwolanie" as const,
        state: "cancelled" as const,
        cancelled_at: "2026-09-20T06:14:00+02:00",
        title: e.title,
      }));
    outSignals = signals.filter((s) => !s.event_id);
    level = "odwolanie";
    since = "2026-09-20T06:14:00+02:00";
  } else if (scenario === "cisza") {
    outEvents = [];
    outSignals = [];
    level = "cisza";
    since = dataAsOf;
    active = 0;
  } else if (scenario === "stale") {
    stale = true;
    dataAsOf = "2026-09-20T04:20:00+02:00";
    outEvents = events.filter((e) => e.id === "2026-0920-016");
    outSignals = signals.filter((s) => !s.event_id);
    level = "obserwacja";
    since = "2026-09-20T04:52:00+02:00";
  } else {
    // alarm — full sample. Below-horizon: items not fused, plus fused-only extras that mock shows (ADS-B 05:36, 14 reports)
    outEvents = events;
    const belowIds = new Set(["s-0920-033", "s-0920-032", "s-0920-030", "s-0920-020", "s-0920-040", "s-0920-043"]);
    outSignals = signals.filter((s) => belowIds.has(s.id) || !s.event_id);
    // app-02 shows only two below-horizon rows
    outSignals = signals.filter((s) => s.id === "s-0920-040" || s.id === "s-0920-043");
  }

  if (scenario === "obserwacja") {
    outSignals = signals.filter((s) => ["s-0920-033", "s-0920-032", "s-0920-030", "s-0920-020"].includes(s.id));
  }

  const srcOn = useStore.getState().sourceOn;
  const sourcesView = sources.map((src) => {
    if (src.id === "radio_ews") {
      const on = srcOn.radio_ews === true;
      return { ...src, enabled: on, health: on ? src.health : ("disabled" as const) };
    }
    if (src.id === "zgloszenia") {
      const on = srcOn.zgloszenia !== false;
      return { ...src, enabled: on, health: on ? src.health : ("disabled" as const) };
    }
    return src;
  });
  const enabled = sourcesView.filter((s) => s.enabled && s.health !== "disabled");
  const activeSources = enabled.filter((s) => s.health === "fresh").length;

  const status: AreaStatus = {
    area,
    level,
    since,
    active_events: outEvents.length || active,
    sources_active: activeSources || 6,
    sources_total: 6,
    data_as_of: dataAsOf,
    stale,
  };

  return { status, events: outEvents, signals: outSignals, sources: sourcesView, sample: true };
}

export function fixtureStatus(scenario: Scenario = "alarm"): StatusPayload {
  const h = fixtureHorizon(null, scenario);
  return {
    level_max: h.status.level,
    sources: h.sources,
    data_as_of: h.status.data_as_of,
    version: statusAll.version || "0.1",
    sample: true,
    area_status: [h.status],
  };
}

export function landingHeroHorizon(): HorizonPayload {
  // site-copy: sample state is obserwacja
  return fixtureHorizon("2401011", "obserwacja");
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json() as Promise<T>;
}

export async function fetchStatus(): Promise<StatusPayload> {
  const sc = activeScenario();
  if (sc) return fixtureStatus(sc === "offline" ? "alarm" : sc);
  try {
    const live = await getJson<StatusPayload>("/api/status");
    if (live?.sources) return { ...live, sample: false };
  } catch {
    /* fall through */
  }
  return fixtureStatus("obserwacja");
}

export async function fetchHorizon(areaId: string | null): Promise<HorizonPayload> {
  const sc = activeScenario();
  if (sc) return fixtureHorizon(areaId, sc === "offline" ? "alarm" : sc);
  try {
    const q = areaId ? `?area=${encodeURIComponent(areaId)}` : "";
    const live = await getJson<HorizonPayload>(`/api/horizon${q}`);
    if (live?.status) return { ...live, sample: false };
  } catch {
    /* fall through */
  }
  const cached = useStore.getState().lastHorizon;
  if (cached) return cached;
  return fixtureHorizon(areaId, "obserwacja");
}

export async function fetchEvent(id: string): Promise<EventItem | null> {
  const sc = activeScenario();
  if (sc) {
    const h = fixtureHorizon(null, sc === "offline" ? "alarm" : sc);
    return h.events.find((e) => e.id === id) ?? eventsAll.find((e) => e.id === id) ?? null;
  }
  try {
    return await getJson<EventItem>(`/api/events/${encodeURIComponent(id)}`);
  } catch {
    return eventsAll.find((e) => e.id === id) ?? useStore.getState().horizon?.events.find((e) => e.id === id) ?? null;
  }
}

export async function fetchSourceItems(id: string): Promise<{ source: Source; items: Signal[] }> {
  const sources = clone(sourcesAll);
  const source = sources.find((s) => s.id === id) ?? sources[0];
  const items = clone(signalsAll)
    .filter((s) => s.source === id)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .slice(-20);
  const sc = activeScenario();
  if (sc) return { source, items };
  try {
    return await getJson(`/api/sources/${encodeURIComponent(id)}`);
  } catch {
    return { source, items };
  }
}

export async function postReport(body: {
  kind: string;
  observed_at: string;
  location: { lat: number; lon: number; rounded_m: 500 };
  note: string;
  area_id?: string;
}): Promise<{ id: string; withdraw_until: string }> {
  try {
    const r = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("report");
    return r.json();
  } catch {
    const id = `r-${Date.now().toString(36)}`;
    const withdraw = new Date(Date.now() + 10 * 60_000).toISOString();
    const queued = { id, withdraw_until: withdraw };
    try {
      const pending = JSON.parse(localStorage.getItem("zorya-report-queue") || "[]") as unknown[];
      pending.push({ ...body, id });
      localStorage.setItem("zorya-report-queue", JSON.stringify(pending));
    } catch {
      /* ignore */
    }
    return queued;
  }
}

export async function deleteReport(id: string): Promise<void> {
  try {
    await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* local only */
  }
}

export function searchAreas(q: string): AreaRef[] {
  const n = q.trim().toLowerCase();
  const extra: AreaRef[] = [
    { id: "12", name: "małopolskie", kind: "wojewodztwo" },
    { id: "14", name: "mazowieckie", kind: "wojewodztwo" },
    { id: "24", name: "śląskie", kind: "wojewodztwo" },
    { id: "06", name: "lubelskie", kind: "wojewodztwo" },
    { id: "20", name: "podlaskie", kind: "wojewodztwo" },
    { id: "18", name: "podkarpackie", kind: "wojewodztwo" },
  ];
  const all = [...areasAll, ...extra];
  if (!n) return all;
  return all.filter((a) => a.name.toLowerCase().includes(n) || a.id.includes(n));
}

export function sourceChip(id: string): string {
  const map: Record<string, string> = {
    rcb: "RCB",
    imgw: "IMGW",
    psp: "PSP",
    syreny: "syreny",
    sdr: "SDR",
    adsb: "SDR",
    radio_ews: "radio",
    zgloszenia: "zgłoszenia",
  };
  return map[id] ?? id;
}

export function signalKindGroup(source: string): string {
  return SOURCE_KIND[source as keyof typeof SOURCE_KIND] ?? "radio";
}

export { eventsAll, signalsAll, sourcesAll, statusAll };
