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
  banderol: "Banderol (pocisk manewrujący)",
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

export function uaIcon(o: Pick<UaThreat, "kind" | "status">): string {
  const base =
    o.kind === "missile_ballistic"
      ? "mua-ballistic"
      : o.kind.startsWith("missile")
        ? "mua-cruise"
        : o.kind === "bomb"
          ? "mua-bomb"
          : "mua-drone";
  return uaDead(o) ? `${base}-dead` : base;
}

export const MAPAUA_URL = "https://mapa.ua/";
