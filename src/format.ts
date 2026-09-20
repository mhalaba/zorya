const TZ = "Europe/Warsaw";

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(d);
}

export function fmtDateISO(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  }).format(d);
  return parts;
}

export function fmtDateTime(iso: string): string {
  return `${fmtDateISO(iso)} ${fmtTime(iso)}`;
}

export function fmtDayTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const same =
    fmtDateISO(iso) ===
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ }).format(now);
  if (same) return fmtTime(iso);
  const day = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", timeZone: TZ }).format(d);
  return `${day}, ${fmtTime(iso)}`;
}

export function validityLine(until: string | null | undefined): string {
  if (!until) return "trwa";
  return `do ${fmtDayTime(until)}`;
}

export function roundTo500m(lat: number, lon: number): { lat: number; lon: number } {
  const m = 500;
  const latM = 111_320;
  const lonM = 111_320 * Math.cos((lat * Math.PI) / 180);
  return {
    lat: Math.round(lat * latM / m) * m / latM,
    lon: Math.round(lon * lonM / m) * m / lonM,
  };
}

export function inQuietHours(from: string, to: string, date = new Date()): boolean {
  const mins = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const parts = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const now = hour * 60 + minute;
  const a = mins(from);
  const b = mins(to);
  if (a === b) return false;
  if (a < b) return now >= a && now < b;
  return now >= a || now < b;
}

export function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function areaChipName(name: string): string {
  return name.replace(/^gmina\s+/i, "");
}
