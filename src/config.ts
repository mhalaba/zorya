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
  minZoom: 4.5,
  maxZoom: 12.5,
  defaultBounds: [
    [14.07, 48.55],
    [29.4, 55.2],
  ] as [[number, number], [number, number]],
  wholePl: [
    [14.07, 44.35],
    [40.15, 55.15],
  ] as [[number, number], [number, number]],
  flank: [
    [21.15, 48.85],
    [26.55, 53.65],
  ] as [[number, number], [number, number]],
  maxBounds: [
    [8.5, 45.8],
    [40.5, 59.6],
  ] as [[number, number], [number, number]],
  padding: { top: 108, bottom: 80, left: 64, right: 96 },
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
