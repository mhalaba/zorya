export type Level = "cisza" | "obserwacja" | "ostrzezenie" | "alarm" | "odwolanie";
export type Confidence = "potwierdzone" | "prawdopodobne" | "pojedynczy" | "niezweryfikowane";
export type SourceKind = "official" | "sensor" | "radio" | "reports";
export type SourceId = "rcb" | "imgw" | "psp" | "syreny" | "sdr" | "adsb" | "radio_ews" | "zgloszenia";
export type EventKind =
  | "air"
  | "weather"
  | "fire"
  | "chemical"
  | "flood"
  | "power"
  | "siren_test"
  | "siren_unscheduled"
  | "aircraft_unidentified"
  | "explosion"
  | "other";
export type AreaKind = "gmina" | "powiat" | "wojewodztwo";
export type EventState = "active" | "cancelled" | "expired";
export type SourceHealth = "fresh" | "stale" | "down" | "disabled";
export type ReportKind = "syrena" | "huk" | "dron_samolot" | "dym_pozar" | "brak_pradu" | "inne";
export type ReportState = "queued" | "sent" | "withdrawn" | "aggregated";
export type ThemePref = "noc" | "dzien" | "system";
export type AreaRole = "dom" | "praca" | "rodzina" | "inne";
export type NavId = "horyzont" | "mapa" | "sygnaly" | "zglos" | "wiecej";

export interface AreaRef {
  id: string;
  name: string;
  kind: AreaKind;
}

export interface Source {
  id: SourceId;
  kind: SourceKind;
  name: string;
  short: string;
  description: string;
  freshness_s: number;
  enabled: boolean;
  locked?: boolean;
  health: SourceHealth;
  last_update: string | null;
  attribution: string;
}

export interface Signal {
  id: string;
  source: SourceId;
  kind: EventKind;
  observed_at: string;
  received_at: string;
  valid_until?: string;
  areas: AreaRef[];
  geometry?: { type: string; coordinates: unknown };
  text: string;
  meta: string;
  original_text?: string;
  original_url?: string;
  measurements?: Record<string, unknown>;
  scheduled?: boolean;
  event_id?: string | null;
  counted?: boolean;
}

export interface EventItem {
  id: string;
  level: Level;
  confidence: Confidence;
  confidence_reason: string;
  kind: EventKind;
  title: string;
  areas: AreaRef[];
  geometry?: { type: string; coordinates: unknown };
  started_at: string;
  updated_at: string;
  valid_until: string | null;
  state: EventState;
  cancelled_at: string | null;
  sources: SourceId[];
  instructions: { official: string; steps: string[] };
  signals: Signal[];
  report_count: number;
}

export interface AreaStatus {
  area: AreaRef;
  level: Level;
  since: string;
  active_events: number;
  sources_active: number;
  sources_total: number;
  data_as_of: string;
  stale: boolean;
}

export interface HorizonPayload {
  status: AreaStatus;
  events: EventItem[];
  signals: Signal[];
  sources: Source[];
  sample?: boolean;
}

export interface StatusPayload {
  level_max: Level;
  sources: Source[];
  data_as_of: string;
  version: string;
  sample?: boolean;
  area_status?: AreaStatus[];
}

export interface WatchedArea {
  area: AreaRef;
  role: AreaRole;
  primary: boolean;
}

export interface QuietHours {
  from: string;
  to: string;
}

export interface UserReport {
  id: string;
  kind: ReportKind;
  observed_at: string;
  location: { lat: number; lon: number; rounded_m: 500 };
  area?: AreaRef;
  note: string;
  state: ReportState;
  withdraw_until?: string;
  place_label?: string;
}

export const LEVEL_ORDER: Record<Level, number> = {
  cisza: 0,
  obserwacja: 1,
  ostrzezenie: 2,
  alarm: 3,
  odwolanie: 4,
};

export const SOURCE_KIND: Record<SourceId, SourceKind> = {
  rcb: "official",
  imgw: "official",
  psp: "official",
  syreny: "sensor",
  sdr: "radio",
  adsb: "radio",
  radio_ews: "radio",
  zgloszenia: "reports",
};

export function maxLevel(levels: Level[]): Level {
  return levels.reduce<Level>((acc, l) => (LEVEL_ORDER[l] > LEVEL_ORDER[acc] ? l : acc), "cisza");
}
