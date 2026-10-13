import { useEffect } from "react";
import { fmtDayTime } from "./format";
import { useStore } from "./store";
import type { AirspaceSnapshot, LocalAlert, LocalAlertsSnapshot, LocalCategory, Notam, NotamCategory, UaThreatsSnapshot } from "./types";

/** GET `path` every `ms` while the tab is visible; the last good answer stays on errors. */
function usePolled<T>(path: string, ms: number, apply: (data: T) => void) {
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          const base = (useStore.getState().backendUrl || "").replace(/\/$/, "");
          const r = await fetch(`${base}${path}`);
          if (r.ok && !stop) apply((await r.json()) as T);
        } catch {
          /* keep the last snapshot */
        }
      }
      if (!stop) t = setTimeout(tick, ms);
    };
    void tick();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(t);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [path, ms, apply]);
}

const applyUa = (d: UaThreatsSnapshot) => useStore.getState().setUaThreats(d);
const applyLocal = (d: LocalAlertsSnapshot) => useStore.getState().setLocalAlerts(d);
const applyAirspace = (d: AirspaceSnapshot) => useStore.getState().setAirspace(d);

/** Map side feeds. The server polls each upstream on its own schedule; these only read its snapshot. */
export function useMapFeeds() {
  usePolled("/api/ua-threats", 30_000, applyUa);
  usePolled("/api/local-alerts", 120_000, applyLocal);
  usePolled("/api/airspace", 300_000, applyAirspace);
}

// ---- local alerts ----------------------------------------------------------------------------

export const LOCAL_META: Record<LocalCategory, { label: string; short: string; color: string; icon: string }> = {
  power: { label: "Prąd", short: "prąd", color: "#F2C14E", icon: "loc-power" },
  water: { label: "Woda", short: "woda", color: "#4FA3E0", icon: "loc-water" },
  gas: { label: "Gaz", short: "gaz", color: "#F0783A", icon: "loc-gas" },
  exercise: { label: "Ćwiczenia", short: "ćwiczenia", color: "#B48CF0", icon: "loc-exercise" },
  meteo: { label: "Pogoda (IMGW)", short: "pogoda", color: "#7DD3FC", icon: "loc-meteo" },
  hydro: { label: "Hydro (IMGW)", short: "hydro", color: "#2E7BD6", icon: "loc-hydro" },
};
export const LOCAL_ORDER: LocalCategory[] = ["power", "water", "gas", "exercise", "meteo", "hydro"];

export function localKindLabel(a: Pick<LocalAlert, "kind" | "category" | "level">): string {
  if (a.kind === "exercise") return "zapowiedź";
  if (a.kind === "warning") {
    if (a.level === -1) return "ostrzeżenie o suszy";
    return a.level && a.level > 0 ? `ostrzeżenie ${a.level}. stopnia` : "ostrzeżenie";
  }
  return a.kind === "planned" ? "planowane wyłączenie" : "awaria";
}

export function localStateLabel(a: Pick<LocalAlert, "state">): string {
  return a.state === "active" ? "trwa" : a.state === "upcoming" ? "zaplanowane" : "zakończone";
}

/** Items the map and lists show: not ended, category switched on. */
export function visibleLocal(snap: LocalAlertsSnapshot | null, cats: Record<LocalCategory, boolean>): LocalAlert[] {
  return (snap?.items ?? []).filter((a) => a.state !== "ended" && a.categories.some((c) => cats[c]));
}

/** "15.10, 08:00 – 14:00" style window; a default window says only when it was published. */
export function localWindow(a: LocalAlert): string {
  if (a.window === "default") return `komunikat z ${fmtDayTime(a.published_at)}`;
  const s = fmtDayTime(a.starts_at);
  if (a.until_cancelled) return `od ${s} do odwołania`;
  const e = fmtDayTime(a.ends_at);
  return s === e ? s : `${s} – ${e}`;
}

// ---- NOTAM -----------------------------------------------------------------------------------

export const NOTAM_META: Record<NotamCategory, { label: string; color: string }> = {
  prohibited: { label: "zakazana (P)", color: "#FF3B30" },
  restricted: { label: "ograniczona (R)", color: "#FF5A4E" },
  danger: { label: "niebezpieczna (D)", color: "#F0783A" },
  temporary: { label: "czasowo ograniczona", color: "#FF2D7A" },
  reserved: { label: "rezerwacja (TSA/TRA)", color: "#E0A100" },
  military: { label: "działania wojskowe", color: "#E0A100" },
  exercise: { label: "ćwiczenia", color: "#B48CF0" },
  firing: { label: "strzelania", color: "#FF8A3D" },
  uas: { label: "drony (BSP)", color: "#3FD0E0" },
  parachute: { label: "skoki spadochronowe", color: "#9AA8B8" },
  display: { label: "pokazy lotnicze", color: "#9AA8B8" },
  warning: { label: "ostrzeżenie", color: "#9AA8B8" },
  gnss: { label: "zakłócenia GNSS", color: "#7DD3FC" },
  airspace: { label: "organizacja przestrzeni", color: "#9AA8B8" },
  other: { label: "inne", color: "#9AA8B8" },
};

export function notamWindow(n: Pick<Notam, "from" | "to" | "permanent" | "estimated">): string {
  const s = n.from ? fmtDayTime(n.from) : "?";
  const e = n.permanent ? "bezterminowo" : n.to ? `${fmtDayTime(n.to)}${n.estimated ? " (szac.)" : ""}` : "?";
  return `${s} – ${e}`;
}

export function notamLimits(n: Pick<Notam, "lower" | "upper">): string {
  if (!n.lower && !n.upper) return "";
  return `${n.lower ?? "?"} – ${n.upper ?? "?"}`;
}

export function geometrySourceLabel(src: Notam["geometry_source"]): string {
  if (src === "text") return "obszar z treści NOTAM";
  if (src === "circle") return "okrąg z treści NOTAM";
  if (src === "qline") return "okrąg z linii Q — przybliżenie";
  if (src === "aup") return "granice strefy z mapy PAŻP (AUP/UUP)";
  return "bez geometrii (tylko lista)";
}
