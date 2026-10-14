import type { MultiPolygon, Polygon } from "geojson";

export type Lang = "pl" | "en";
export type ViewId = "map" | "signals" | "history" | "more";
export type Level = "info" | "watch" | "priority";
export type Paint = "info" | "watch" | "priority" | "transfer";
export type Diode = "ok" | "late" | "dead" | "off";
export type ObjectType =
  | "shahed"
  | "drone"
  | "cruise"
  | "ballistic"
  | "aircraft"
  | "helicopter"
  | "mig31k"
  | "unknown";

export type SourceId = "neptun" | "ua" | "adsb" | "rss" | "rcb" | "pazp";

export interface SourceStatus {
  id: SourceId;
  ok: boolean;
  age_s: number;
  message: string;
  records: number;
  diode: Diode;
}

export interface Breakdown {
  neptun: number;
  ua: number;
  rcb: number;
  media: number;
  pazp: number;
  other: number;
}

export interface VoivodeshipState {
  id: string;
  name: string;
  nameEn: string;
  eastRank: number;
  /** Centre used for scoring; the map hangs local-alert badges here. */
  lat: number;
  lon: number;
  points: number;
  own: number;
  transfer: number;
  level: Level;
  paint: Paint;
  breakdown: Breakdown;
  transferred_from: { id: string; name: string; points: number }[];
  whyPl: string;
  whyEn: string;
}

export interface TrackedObject {
  id: string;
  type: ObjectType;
  title: string;
  lat: number;
  lon: number;
  unc_km: number;
  course: number | null;
  speed: number | null;
  eta_min: number | null;
  confidence: number;
  confirmations: number;
  loc_quality: string;
  lifecycle: string;
  ts: string;
  dist_pl_km: number;
  azimuth_pl: number;
  observation: boolean;
  points_contrib: { id: string; points: number }[];
  trail: { lat: number; lon: number; ts: number }[];
}

export interface AdsbCraft {
  id: string;
  callsign: string;
  type: string;
  mil: boolean;
  lat: number;
  lon: number;
  heading: number;
  alt_ft: number;
  speed_kt: number;
  ts: number;
}

export interface PazpZone {
  id: string;
  type: string;
  code: string;
  from: string;
  to: string;
  scores: boolean;
  reason: string;
  voivodeships: string[];
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface UaAlert {
  oblast: string;
  name: string;
  nameEn: string;
  active: boolean;
  since: string | null;
  dist_km: number;
}

export interface Signal {
  id: string;
  source: string;
  title: string;
  url: string | null;
  ts: string;
  weight: number;
  points: number;
  voivodeships: string[];
}

export interface CameraSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: string;
  note: string;
}

/**
 * Powiat levels (server/fusion.mjs scorePowiaty), compact: [teryt, "w" (watch) | "p" (priority), points, why index].
 * Powiaty not listed are "info".
 */
export interface PowiatLevels {
  why: string[];
  /** [teryt, "w" | "p", points, why index, km to the nearest object (5 km steps) or null]; why may hold "{km}". */
  list: [string, "w" | "p", number, number, number | null][];
}

export interface PowiatState {
  id: string;
  level: Level;
  points: number;
  whyPl: string;
}

export interface FusionState {
  generated_at: string;
  demo: boolean;
  sources: SourceStatus[];
  voivodeships: VoivodeshipState[];
  powiaty?: PowiatLevels;
  objects: TrackedObject[];
  adsb: AdsbCraft[];
  zones: PazpZone[];
  ua_alerts: UaAlert[];
  signals: Signal[];
  cameras: CameraSite[];
}

export interface HistoryBundle {
  generated_at: string;
  hours: number;
  step_s: number;
  t0: string;
  n: number;
  max_pl: number[];
  voivodeships: Record<string, number[]>;
  objects: { id: string; type: string; samples: { t: number; lat: number; lon: number }[] }[];
  signals: Signal[];
}

export interface Place {
  id: string;
  name: string;
  voivodeship: string;
  lat?: number;
  lon?: number;
  notifyWatch: boolean;
  notifyPriority: boolean;
}

/** MAPA.UA object, trimmed by server/mapaua.mjs. Times in ms since epoch. */
export interface UaThreat {
  id: string;
  kind: string;
  subkind: string | null;
  amount: number;
  title: string;
  status: string;
  heading: number | null;
  speed_kmh: number | null;
  lat: number;
  lon: number;
  predicted: [number, number] | null;
  trail: [number, number][];
  first_seen: number | null;
  last_seen: number;
  from_zone: string | null;
  from_name: string | null;
  to_city: string | null;
  to_name: string | null;
}

export interface UaThreatsSnapshot {
  enabled: boolean;
  ok: boolean;
  fetched_at: string | null;
  source_ts: string | null;
  error: string | null;
  attack: { id: number; status: string; started_at: number | null } | null;
  objects: UaThreat[];
  pl_violations: { count: number; hours: number; checked_at: string } | null;
}

/**
 * Local alert (server/local.mjs, operators.mjs, imgw.mjs): water / power / gas outage or planned works, an exercise,
 * or an IMGW meteorological / hydrological warning. Informational only — never part of the threat level.
 */
export type LocalCategory = "power" | "water" | "gas" | "exercise" | "meteo" | "hydro";

export interface LocalAlert {
  id: string;
  source: string;
  source_name: string;
  categories: LocalCategory[];
  category: LocalCategory;
  kind: "outage" | "planned" | "exercise" | "warning";
  /** IMGW warning level: 1–3, or -1 for hydrological drought. */
  level?: number | null;
  /** IMGW: valid until cancelled (ends_at is then only a display horizon). */
  until_cancelled?: boolean;
  title: string;
  summary: string;
  url: string | null;
  published_at: string;
  starts_at: string;
  ends_at: string;
  /** "text": window read from the notice; "default": no date in it, shown for a fixed time after publication. */
  window: "text" | "default" | "source";
  voivodeships: string[];
  /** TERYT of the gminy (7 digits) / powiaty (4 digits) the source names or locates; empty = whole voivodeship. */
  gminy?: string[];
  powiaty?: string[];
  /** Exact place from the source ([lon, lat]), e.g. an operator's outage point. */
  point?: [number, number] | null;
  /** Map position: point, else the gmina's / single powiat's anchor; null = voivodeship only. */
  at?: [number, number] | null;
  precision?: "point" | "gmina" | "powiat" | "voivodeship";
  state: "active" | "upcoming" | "ended";
}

/** /api/place: the gmina of a point (map click, search, "my location"), with its powiat and voivodeship. */
export interface PlaceInfo {
  gmina: {
    id: string;
    name: string;
    kind: string;
    label: string;
    powiat: { id: string; name: string; label: string };
    voivodeship: string;
    anchor: [number, number];
    bbox: [number, number, number, number];
  };
  powiat: { id: string; name: string; label: string; city: boolean; voivodeship: string; anchor: [number, number]; bbox: [number, number, number, number] } | null;
  voivodeship: string;
}

export interface LocalAlertsSnapshot {
  generated_at: string;
  sources: { id: string; name?: string; ok: boolean; at: string | null; error: string | null; records: number }[];
  items: LocalAlert[];
}

export type NotamCategory =
  | "prohibited"
  | "restricted"
  | "danger"
  | "temporary"
  | "reserved"
  | "military"
  | "exercise"
  | "firing"
  | "uas"
  | "parachute"
  | "display"
  | "warning"
  | "gnss"
  | "airspace"
  | "other";

/** NOTAM (server/notam.mjs). Times are ISO strings in UTC. */
export interface Notam {
  id: string;
  location: string | null;
  type: "N" | "R" | "C";
  replaces: string | null;
  qcode: string | null;
  category: NotamCategory;
  label: string;
  condition: string;
  condition_label: string;
  from: string | null;
  to: string | null;
  permanent: boolean;
  estimated: boolean;
  schedule: string | null;
  lower: string | null;
  upper: string | null;
  text: string;
  raw: string;
  center: [number, number] | null;
  radius_nm: number | null;
  geometry: Polygon | MultiPolygon | null;
  geometry_source: "text" | "circle" | "qline" | "aup" | null;
  bbox: [number, number, number, number] | null;
  voivodeships: string[];
  gminy?: string[];
  powiaty?: string[];
  map: boolean;
  state: "active" | "upcoming";
}

/** Permanent airspace area (server/airspace.mjs, OpenAIP). */
export interface AirspaceZone {
  id: string;
  name: string;
  kind: "restricted" | "danger" | "prohibited" | "reserved";
  code: string;
  label: string;
  lower: string | null;
  upper: string | null;
  by_notam: boolean;
  geometry: Polygon | MultiPolygon;
  voivodeships: string[];
}

export interface AirspaceSnapshot {
  generated_at: string;
  notam: {
    enabled: boolean;
    ok: boolean;
    source: string;
    locations: string[];
    fetched_at: string | null;
    error: string | null;
    total: number;
    /** NOTAMs not shown (obstacles, lighting, navaids, aerodrome services). */
    skipped: number;
    /** The source had more NOTAMs than were read. */
    truncated: boolean;
    items: Notam[];
    /** PAŻP AUP/UUP reservations merged into items (geometry_source "aup"). */
    aup?: { enabled: boolean; ok: boolean; fetched_at: string | null; error: string | null; count: number; link: string };
  };
  zones: {
    enabled: boolean;
    ok: boolean;
    source: string;
    fetched_at: string | null;
    error: string | null;
    items: AirspaceZone[];
  };
}

/** Internet outage item from server/netoutage.mjs (IODA). Times in ms since epoch. */
export interface NetOutageItem {
  scope: "country" | "region";
  id: string;
  country: string;
  name: string;
  lat: number;
  lon: number;
  score: number;
  severity: number;
  events: number;
  active: boolean;
  last_alert: number | null;
  sources: string[];
  sources_pl: string[];
  alerts: { time: number; level: string; source: string; source_pl: string; value: number | null; expected: number | null }[];
}

export interface NetOutagesSnapshot {
  enabled: boolean;
  ok: boolean;
  fetched_at: string | null;
  error: string | null;
  window_h: number;
  items: NetOutageItem[];
  signals: Record<string, { source: string; source_pl: string; from: number; step_s: number | null; values: (number | null)[] }[]>;
  cloudflare: { enabled: boolean; ok: boolean | null; error: string | null;
    items: { id: string; countries: string[]; start: string | null; end: string | null; cause: string | null; type: string | null; description: string; link: string | null }[] };
  attribution: string;
}

/** GNSS interference snapshot from server/gnss.mjs. */
export interface GnssSnapshot {
  enabled: boolean;
  generated_at: string;
  method: string;
  attribution: string[];
  daily: { ok: boolean; date: string | null; fetched_at: string | null; error: string | null; cells: number };
  live: { enabled: boolean; ok: boolean; updated_at: string | null; error: string | null; provider: string | null;
    window_min: number; cells: number; samples: number; hot_cells: number };
  features: import("geojson").FeatureCollection;
}
