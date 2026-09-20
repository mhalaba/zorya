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

export interface FusionState {
  generated_at: string;
  demo: boolean;
  sources: SourceStatus[];
  voivodeships: VoivodeshipState[];
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
