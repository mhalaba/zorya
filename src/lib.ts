export function fmtPts(n: number, lang: string) {
  return n.toLocaleString(lang === "en" ? "en-GB" : "pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function ageSeconds(iso: string, now = Date.now()) {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
}

export function ageLabel(seconds: number, lang: string) {
  if (seconds < 60) return lang === "en" ? `${seconds}s` : `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return lang === "en" ? `${m} min` : `${m} min`;
  const h = Math.floor(m / 60);
  return lang === "en" ? `${h} h` : `${h} h`;
}

export function destPoint(lon: number, lat: number, km: number, bearing: number) {
  const R = 6371;
  const br = (bearing * Math.PI) / 180;
  const p1 = (lat * Math.PI) / 180;
  const l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(km / R) + Math.cos(p1) * Math.sin(km / R) * Math.cos(br));
  const l2 =
    l1 + Math.atan2(Math.sin(br) * Math.sin(km / R) * Math.cos(p1), Math.cos(km / R) - Math.sin(p1) * Math.sin(p2));
  return [((l2 * 180) / Math.PI + 540) % 360 - 180, (p2 * 180) / Math.PI] as [number, number];
}

export function circlePoly(lon: number, lat: number, km: number, n = 48) {
  const ring: [number, number][] = [];
  for (let i = 0; i <= n; i++) ring.push(destPoint(lon, lat, km, (i / n) * 360));
  return [ring];
}

export function diodeColor(d: string) {
  if (d === "ok") return "#3DDC84";
  if (d === "late") return "#E0A100";
  if (d === "dead") return "#D7263D";
  return "#4A5568";
}

export function paintFill(paint: string) {
  if (paint === "priority") return "#D7263D";
  if (paint === "watch") return "#E0A100";
  if (paint === "transfer") return "#6B7F3A";
  return "#0B1220";
}

export function paintOpacity(paint: string) {
  if (paint === "priority") return 0.45;
  if (paint === "watch") return 0.35;
  if (paint === "transfer") return 0.2;
  return 0.42;
}

export function strongestSource(b: { neptun: number; ua: number; rcb: number; media: number; pazp: number; other: number }) {
  const entries: [string, number][] = [
    ["NEPTUN", b.neptun],
    ["Alarmy UA", b.ua],
    ["RCB/RSO", b.rcb],
    ["RSS", b.media],
    ["PAŻP", b.pazp],
    ["inne", b.other],
  ];
  entries.sort((a, c) => c[1] - a[1]);
  return entries[0][1] > 0.04 ? entries[0][0] : "—";
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function azimuthDeg(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const y = Math.sin(((toLon - fromLon) * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180);
  const x =
    Math.cos((fromLat * Math.PI) / 180) * Math.sin((toLat * Math.PI) / 180) -
    Math.sin((fromLat * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180) * Math.cos(((toLon - fromLon) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function nearestPlaceDist(
  places: { name: string; lat?: number; lon?: number }[],
  lat: number,
  lon: number
) {
  const withGps = places.filter((p) => typeof p.lat === "number" && typeof p.lon === "number") as {
    name: string;
    lat: number;
    lon: number;
  }[];
  if (!withGps.length) return null;
  let best = withGps[0];
  let km = haversineKm(best.lat, best.lon, lat, lon);
  for (const p of withGps.slice(1)) {
    const d = haversineKm(p.lat, p.lon, lat, lon);
    if (d < km) {
      km = d;
      best = p;
    }
  }
  return {
    name: best.name,
    km: Math.round(km * 10) / 10,
    az: Math.round((((azimuthDeg(best.lat, best.lon, lat, lon) % 360) + 360) % 360)),
  };
}

export const uid = () => Math.random().toString(36).slice(2, 9);

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
