import type { UaThreat } from "./types";

/** Polish labels for MAPA.UA objects. Unknown subkind → kind label → raw code. */
const KIND: Record<string, string> = {
  missile_cruise: "pocisk manewrujący",
  missile_ballistic: "pocisk balistyczny",
  bomb: "bomba kierowana (KAB)",
  drone_jet: "dron odrzutowy",
  drone_piston: "dron z silnikiem tłokowym",
  drone_fpv: "dron FPV",
};

const SUBKIND: Record<string, string> = {
  kalibr: "Kalibr (pocisk manewrujący)",
  kh101: "Ch-101 (pocisk manewrujący)",
  x101: "Ch-101 (pocisk manewrujący)",
  ch101: "Ch-101 (pocisk manewrujący)",
  kh555: "Ch-555 (pocisk manewrujący)",
  kh59: "Ch-59 (pocisk manewrujący)",
  x59: "Ch-59 (pocisk manewrujący)",
  ch59: "Ch-59 (pocisk manewrujący)",
  kh69: "Ch-69 (pocisk manewrujący)",
  kh22: "Ch-22 (pocisk przeciwokrętowy)",
  kh32: "Ch-32 (pocisk przeciwokrętowy)",
  kh31: "Ch-31 (pocisk przeciwradarowy)",
  kh35: "Ch-35 (pocisk przeciwokrętowy)",
  kinzhal: "Kindżał (pocisk aerobalistyczny)",
  kindzhal: "Kindżał (pocisk aerobalistyczny)",
  iskander: "Iskander (pocisk balistyczny)",
  iskanderm: "Iskander-M (pocisk balistyczny)",
  iskanderk: "Iskander-K (pocisk manewrujący)",
  kn23: "KN-23 (pocisk balistyczny)",
  zircon: "Cyrkon (pocisk hipersoniczny)",
  tsirkon: "Cyrkon (pocisk hipersoniczny)",
  oniks: "Oniks (pocisk przeciwokrętowy)",
  s300: "S-300 (pocisk przeciwlotniczy na cel naziemny)",
  s400: "S-400 (pocisk przeciwlotniczy na cel naziemny)",
  ballistic: "pocisk balistyczny",
  banderol: "Banderol S8000 (odrzutowa amunicja krążąca)",
  shahed: "Shahed / Gerań (dron)",
  geran: "Shahed / Gerań (dron)",
  gerbera: "Gerbera (dron-wabik)",
};

const STATUS: Record<string, string> = {
  active: "w locie (aktywny)",
  lost: "utracony z obserwacji",
  eliminated: "zestrzelony / zneutralizowany",
  hit_target: "trafił w cel",
};

export function uaTypeLabel(o: Pick<UaThreat, "kind" | "subkind">): string {
  const sk = (o.subkind || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sk && SUBKIND[sk]) return SUBKIND[sk];
  if (o.subkind && KIND[o.subkind]) return KIND[o.subkind];
  return KIND[o.kind] ?? o.kind;
}

export function uaStatusLabel(status: string): string {
  return STATUS[status] ?? status ?? "—";
}

export function uaDead(o: Pick<UaThreat, "status">): boolean {
  return o.status === "eliminated" || o.status === "lost" || o.status === "hit_target";
}

export type UaGroup = "missile" | "bomb" | "drone";

export function uaGroup(kind: string): UaGroup {
  if (kind.startsWith("missile")) return "missile";
  if (kind === "bomb") return "bomb";
  return "drone";
}

/** Icon family for a threat: drone (Shahed), jet, banderol, cruise, ballistic, bomb (see map/icons.ts). */
export function uaType(o: Pick<UaThreat, "kind" | "subkind">): string {
  const sk = (o.subkind || "").toLowerCase();
  if (sk.includes("banderol")) return "banderol";
  if (o.kind === "missile_ballistic" || sk.includes("ballistic") || sk.includes("iskander") || sk.includes("kinzhal")) return "ballistic";
  if (o.kind.startsWith("missile")) return "cruise";
  if (o.kind === "bomb") return "bomb";
  if (o.kind === "drone_jet") return "jet";
  return "drone";
}

export function uaIcon(o: Pick<UaThreat, "kind" | "subkind" | "status">): string {
  const base = `mua-${uaType(o)}`;
  return uaDead(o) ? `${base}-dead` : base;
}

/**
 * mapa.ua's live fading: full brightness up to 5 min after the last update, then fading (to 0.35 at 30 min).
 * Dead markers start dimmed and fade out.
 */
export function uaFreshness(o: Pick<UaThreat, "status" | "last_seen">, now = Date.now()): number {
  const age = Math.max(0, (now - o.last_seen) / 60_000);
  if (uaDead(o)) return Math.max(0.15, 0.5 - age / 30);
  // mapa.ua-like: full for 5 min, then a clearly visible fade (0.2 at 30 min, 0.1 at 60 min).
  if (age <= 5) return 1;
  if (age <= 30) return 1 - ((age - 5) / 25) * 0.8;
  return Math.max(0.1, 0.2 - ((age - 30) / 30) * 0.1);
}

/** Units in flight (amount-weighted), the way mapa.ua's header counts them: fresh, not lost or shot down. */
export function uaLiveUnits(list: Pick<UaThreat, "status" | "amount">[]): number {
  return list.reduce((n, o) => n + (uaDead(o) ? 0 : Math.max(1, o.amount || 1)), 0);
}

export type UaLayerToggles = { missile: boolean; bomb: boolean; drone: boolean };
const HIDE_AFTER_MS = 60 * 60_000;

/**
 * The one list of Ukraine threats the map draws; every count (layer button, layer panel, status bar) is
 * computed from it, so they always agree with what is on screen. Hidden: switched-off layers, FPV
 * (tactical, not tracked), anything older than 60 min, and fallback objects (MAPA.UA / NEPTUN) still
 * outside Ukraine (a launch-zone guess in Bryansk is not a threat on the map yet).
 */
export function uaDrawn(list: UaThreat[] | undefined, on: UaLayerToggles, inUa: (lon: number, lat: number) => boolean, now = Date.now()): UaThreat[] {
  return (list ?? []).filter(
    (o) =>
      on[uaGroup(o.kind)] &&
      o.kind !== "drone_fpv" &&
      now - o.last_seen <= HIDE_AFTER_MS &&
      (!o.source || o.source === "own" || inUa(o.lon, o.lat))
  );
}

/** Counts over the drawn list: units in flight per group, and objects per source. */
export function uaCounts(drawn: UaThreat[]) {
  const live = drawn.filter((o) => !uaDead(o));
  const units = (g: UaGroup) => uaLiveUnits(live.filter((o) => uaGroup(o.kind) === g));
  return {
    missile: units("missile"),
    bomb: units("bomb"),
    drone: units("drone"),
    units: uaLiveUnits(live),
    objects: drawn.length,
    own: drawn.filter((o) => !o.source || o.source === "own").length,
    mapaua: drawn.filter((o) => o.source === "mapa.ua").length,
    neptun: drawn.filter((o) => o.source === "neptun").length,
  };
}

export const MAPAUA_URL = "https://mapa.ua/";
export const NEPTUN_URL = "https://neptun.in.ua/";

/** Who produced the object: our own engine or a fallback source. */
export function uaSourceLabel(src: string | undefined): string {
  if (src === "mapa.ua") return "MAPA.UA (uzupełnienie)";
  if (src === "neptun") return "NEPTUN (uzupełnienie)";
  return "własny silnik Zorya (kanały Telegram)";
}
