export const SUPPORT_URL = "https://buycoffee.to/maha";
export const GUIDE_URL = "https://www.gov.pl/web/rcb/alert-rcb";

export const COLORS = {
  bg: "#070B12",
  panel: "#0E1624",
  border: "#1C2A3F",
  text: "#E8EEF7",
  muted: "#9AA8B8",
  amber: "#E0A100",
  crimson: "#D7263D",
  ok: "#3DDC84",
  cyan: "#5B8CFF",
  olive: "#6B7F3A",
  navy: "#0B1220",
  uaRest: "#140E1C",
  uaAlert: "#D7263D",
};

export const CAMERA = {
  // Low enough that a portrait phone can still fit Poland plus Ukraine and the Baltics.
  minZoom: 2.5,
  maxZoom: 12.5,
  defaultBounds: [
    [14.07, 48.55],
    [29.4, 55.2],
  ] as [[number, number], [number, number]],
  wholePl: [
    [14.07, 44.35],
    [40.15, 55.15],
  ] as [[number, number], [number, number]],
  /** Everything Zorya draws: Poland, all of Ukraine (incl. Crimea) and the Baltic states. */
  all: [
    [13.8, 44.2],
    [40.4, 60.0],
  ] as [[number, number], [number, number]],
  flank: [
    [21.15, 48.85],
    [26.55, 53.65],
  ] as [[number, number], [number, number]],
  // Only a loose guard against panning off into the ocean. It must stay well outside `all`,
  // because maplibre never lets the viewport exceed maxBounds (that used to force a higher
  // zoom on phones and cut Poland/Ukraine off).
  maxBounds: [
    [-15, 30],
    [60, 72],
  ] as [[number, number], [number, number]],
  padding: { top: 40, bottom: 40, left: 16, right: 16 },
  /** Extra room so the HUD, zoom buttons and counters don't sit on top of the frame. */
  allPadding: { top: 56, bottom: 44, left: 20, right: 20 },
};

export const EAST_IDS = ["podlaskie", "lubelskie", "podkarpackie", "mazowieckie", "warminsko-mazurskie"];

export const SOURCE_LABEL: Record<string, { pl: string; en: string }> = {
  neptun: { pl: "NEPTUN", en: "NEPTUN" },
  ua: { pl: "Alarmy UA", en: "UA alerts" },
  adsb: { pl: "ADS-B", en: "ADS-B" },
  rss: { pl: "RSS", en: "RSS" },
  rcb: { pl: "RCB/RSO", en: "RCB/RSO" },
  pazp: { pl: "PAŻP", en: "PAŻP" },
  baltic: { pl: "Bałtyk", en: "Baltic" },
  nato: { pl: "NATO", en: "NATO" },
};

export const OBJECT_LABEL: Record<string, { pl: string; en: string }> = {
  shahed: { pl: "Shahed", en: "Shahed" },
  drone: { pl: "dron / BpSP", en: "drone / UAS" },
  cruise: { pl: "pocisk manewrujący", en: "cruise missile" },
  ballistic: { pl: "balistyczny", en: "ballistic" },
  aircraft: { pl: "samolot", en: "aircraft" },
  helicopter: { pl: "śmigłowiec", en: "helicopter" },
  mig31k: { pl: "MiG-31K", en: "MiG-31K" },
  unknown: { pl: "nieznany", en: "unknown" },
};
