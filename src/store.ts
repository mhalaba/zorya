import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AreaRole,
  HorizonPayload,
  NavId,
  QuietHours,
  SourceId,
  ThemePref,
  UserReport,
  WatchedArea,
} from "./model";

export type Sheet =
  | { kind: "areas" }
  | { kind: "filter" }
  | { kind: "map-event"; id: string }
  | { kind: "map-sensor"; id: string }
  | { kind: "theme" }
  | { kind: "quiet" }
  | { kind: "add-area" }
  | null;

interface Settings {
  theme: ThemePref;
  reduceMotion: boolean;
  areas: WatchedArea[];
  notifyOstrzezenie: boolean;
  notifyObserwacja: boolean;
  notifyOdwolanie: boolean;
  quiet: QuietHours;
  sourceOn: Record<string, boolean>;
  onboardingDone: boolean;
  notifyGranted: boolean;
  mutedEvents: Record<string, number>;
  reports: UserReport[];
  alarmOpened: Record<string, boolean>;
  lastHorizon: HorizonPayload | null;
}

interface Live {
  view: NavId;
  sheet: Sheet;
  selectedAreaId: string | null;
  horizon: HorizonPayload | null;
  loading: boolean;
  offline: boolean;
  error: string | null;
  sample: boolean;
  signalFilter: Record<string, boolean>;
  mapLayers: { events: boolean; sensors: boolean; areas: boolean };
}

interface Actions {
  setTheme: (theme: ThemePref) => void;
  setReduceMotion: (v: boolean) => void;
  setAreas: (areas: WatchedArea[]) => void;
  addArea: (area: WatchedArea) => void;
  setNotify: (k: "ostrzezenie" | "obserwacja" | "odwolanie", v: boolean) => void;
  setQuiet: (quiet: QuietHours) => void;
  setSourceOn: (id: SourceId | string, v: boolean) => void;
  completeOnboarding: (areas: WatchedArea[], notifyGranted: boolean) => void;
  setNotifyGranted: (v: boolean) => void;
  muteEvent: (id: string, until: number) => void;
  addReport: (r: UserReport) => void;
  withdrawReport: (id: string) => void;
  markAlarmOpened: (id: string) => void;
  cacheHorizon: (h: HorizonPayload | null) => void;
  setView: (view: NavId) => void;
  setSheet: (sheet: Sheet) => void;
  setSelectedAreaId: (id: string | null) => void;
  setHorizon: (h: HorizonPayload | null, meta: { loading?: boolean; offline?: boolean; sample?: boolean; error?: string | null }) => void;
  setLoading: (v: boolean) => void;
  setOffline: (v: boolean) => void;
  setError: (v: string | null) => void;
  setSignalFilter: (k: string, v: boolean) => void;
  setMapLayer: (k: "events" | "sensors" | "areas", v: boolean) => void;
}

export type Store = Settings & Live & Actions;

export const useStore = create<Store>()(
  persist(
    (set) => ({
      theme: "system",
      reduceMotion: false,
      areas: [],
      notifyOstrzezenie: true,
      notifyObserwacja: false,
      notifyOdwolanie: true,
      quiet: { from: "22:00", to: "06:00" },
      sourceOn: { zgloszenia: true, radio_ews: false },
      onboardingDone: false,
      notifyGranted: false,
      mutedEvents: {},
      reports: [],
      alarmOpened: {},
      lastHorizon: null,
      view: "horyzont",
      sheet: null,
      selectedAreaId: null,
      horizon: null,
      loading: true,
      offline: false,
      error: null,
      sample: false,
      signalFilter: { official: true, sensor: true, radio: true, reports: true },
      mapLayers: { events: true, sensors: false, areas: false },
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setAreas: (areas) => set({ areas, selectedAreaId: areas.find((a) => a.primary)?.area.id ?? areas[0]?.area.id ?? null }),
      addArea: (area) =>
        set((s) => {
          if (s.areas.length >= 5) return s;
          if (s.areas.some((a) => a.area.id === area.area.id)) return s;
          const areas = s.areas.length === 0 ? [{ ...area, primary: true }] : [...s.areas, area];
          return { areas, selectedAreaId: s.selectedAreaId ?? areas[0].area.id };
        }),
      setNotify: (k, v) =>
        set(
          k === "ostrzezenie"
            ? { notifyOstrzezenie: v }
            : k === "obserwacja"
              ? { notifyObserwacja: v }
              : { notifyOdwolanie: v }
        ),
      setQuiet: (quiet) => set({ quiet }),
      setSourceOn: (id, v) => set((s) => ({ sourceOn: { ...s.sourceOn, [id]: v } })),
      completeOnboarding: (areas, notifyGranted) =>
        set({
          onboardingDone: true,
          areas,
          notifyGranted,
          selectedAreaId: areas.find((a) => a.primary)?.area.id ?? areas[0]?.area.id ?? null,
        }),
      setNotifyGranted: (notifyGranted) => set({ notifyGranted }),
      muteEvent: (id, until) => set((s) => ({ mutedEvents: { ...s.mutedEvents, [id]: until } })),
      addReport: (r) => set((s) => ({ reports: [r, ...s.reports] })),
      withdrawReport: (id) =>
        set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, state: "withdrawn" as const } : r)) })),
      markAlarmOpened: (id) => set((s) => ({ alarmOpened: { ...s.alarmOpened, [id]: true } })),
      cacheHorizon: (lastHorizon) => set({ lastHorizon }),
      setView: (view) => set({ view, sheet: null }),
      setSheet: (sheet) => set({ sheet }),
      setSelectedAreaId: (selectedAreaId) => set({ selectedAreaId, sheet: null }),
      setHorizon: (horizon, meta) =>
        set({
          horizon,
          loading: meta.loading ?? false,
          offline: meta.offline ?? false,
          sample: meta.sample ?? horizon?.sample ?? false,
          error: meta.error === undefined ? null : meta.error,
          lastHorizon: horizon ?? undefined,
        }),
      setLoading: (loading) => set({ loading }),
      setOffline: (offline) => set({ offline }),
      setError: (error) => set({ error }),
      setSignalFilter: (k, v) => set((s) => ({ signalFilter: { ...s.signalFilter, [k]: v } })),
      setMapLayer: (k, v) => set((s) => ({ mapLayers: { ...s.mapLayers, [k]: v } })),
    }),
    {
      name: "zorya-local-v2",
      partialize: (s) => ({
        theme: s.theme,
        reduceMotion: s.reduceMotion,
        areas: s.areas,
        notifyOstrzezenie: s.notifyOstrzezenie,
        notifyObserwacja: s.notifyObserwacja,
        notifyOdwolanie: s.notifyOdwolanie,
        quiet: s.quiet,
        sourceOn: s.sourceOn,
        onboardingDone: s.onboardingDone,
        notifyGranted: s.notifyGranted,
        mutedEvents: s.mutedEvents,
        reports: s.reports,
        alarmOpened: s.alarmOpened,
        lastHorizon: s.lastHorizon,
        selectedAreaId: s.selectedAreaId,
      }),
    }
  )
);

export function areaRoleLabel(role: AreaRole): string {
  return { dom: "dom", praca: "praca", rodzina: "rodzina", inne: "inne" }[role];
}
