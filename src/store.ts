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
import type { FusionState, HistoryBundle, Lang, Place } from "./types";

export type Sheet =
  | { kind: "areas" }
  | { kind: "filter" }
  | { kind: "map-event"; id: string }
  | { kind: "map-sensor"; id: string }
  | { kind: "theme" }
  | { kind: "quiet" }
  | { kind: "add-area" }
  | null;

export type Drawer =
  | { kind: "source"; id: string }
  | { kind: "legend" }
  | { kind: "object"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "cameras" }
  | { kind: "adsb"; id: string }
  | { kind: "voiv"; id: string }
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
  lang: Lang;
  backendUrl: string;
  muted: boolean;
  pitch3d: boolean;
  showPazp: boolean;
  showTracks: boolean;
  showCivAdsb: boolean;
  showMilAdsb: boolean;
  showNeptun: boolean;
  showUaAlerts: boolean;
  labelDensity: "low" | "dense";
  places: Place[];
  homeVoiv: string | null;
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
  state: FusionState | null;
  stateAt: number | null;
  connecting: boolean;
  drawer: Drawer;
  selectedVoiv: string | null;
  hoverVoiv: string | null;
  cameraPreset: "default" | "region" | "pl" | "flank";
  cameraNonce: number;
  historyMode: boolean;
  history: HistoryBundle | null;
  historyIdx: number;
  historyPlaying: boolean;
  historySpeed: 1 | 4 | 12;
  sirenOn: boolean;
  sirenVoiv: string | null;
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
  setLang: (lang: Lang) => void;
  setBackendUrl: (url: string) => void;
  setMuted: (v: boolean) => void;
  setPitch3d: (v: boolean) => void;
  setShowPazp: (v: boolean) => void;
  setShowTracks: (v: boolean) => void;
  setShowCivAdsb: (v: boolean) => void;
  setShowMilAdsb: (v: boolean) => void;
  setShowNeptun: (v: boolean) => void;
  setShowUaAlerts: (v: boolean) => void;
  setLabelDensity: (v: "low" | "dense") => void;
  setPlaces: (places: Place[]) => void;
  setHomeVoiv: (id: string | null) => void;
  setDrawer: (d: Drawer) => void;
  setSelectedVoiv: (id: string | null) => void;
  setHoverVoiv: (id: string | null) => void;
  setCameraPreset: (p: Live["cameraPreset"]) => void;
  bumpCamera: () => void;
  setLiveState: (s: FusionState) => void;
  setConnecting: (v: boolean) => void;
  setHistory: (h: HistoryBundle | null) => void;
  setHistoryMode: (v: boolean) => void;
  setHistoryIdx: (i: number) => void;
  setHistoryPlaying: (v: boolean) => void;
  setHistorySpeed: (s: 1 | 4 | 12) => void;
  setSiren: (on: boolean, voiv?: string | null) => void;
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
      lang: "pl",
      backendUrl: "",
      muted: false,
      pitch3d: false,
      showPazp: false,
      showTracks: true,
      showCivAdsb: true,
      showMilAdsb: true,
      showNeptun: true,
      showUaAlerts: true,
      labelDensity: "dense",
      places: [],
      homeVoiv: null,
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
      state: null,
      stateAt: null,
      connecting: true,
      drawer: null,
      selectedVoiv: null,
      hoverVoiv: null,
      cameraPreset: "default",
      cameraNonce: 0,
      historyMode: false,
      history: null,
      historyIdx: 0,
      historyPlaying: false,
      historySpeed: 1,
      sirenOn: false,
      sirenVoiv: null,
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
          homeVoiv: areas.find((a) => a.area.kind === "wojewodztwo")?.area.id ?? null,
        }),
      setNotifyGranted: (notifyGranted) => set({ notifyGranted }),
      muteEvent: (id, until) => set((s) => ({ mutedEvents: { ...s.mutedEvents, [id]: until } })),
      addReport: (r) => set((s) => ({ reports: [r, ...s.reports] })),
      withdrawReport: (id) =>
        set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, state: "withdrawn" as const } : r)) })),
      markAlarmOpened: (id) => set((s) => ({ alarmOpened: { ...s.alarmOpened, [id]: true } })),
      cacheHorizon: (h) => {
        if (h?.sample) return;
        set({ lastHorizon: h });
      },
      setView: (view) => set({ view, sheet: null }),
      setSheet: (sheet) => set({ sheet }),
      setSelectedAreaId: (selectedAreaId) => set({ selectedAreaId, sheet: null }),
      setHorizon: (horizon, meta) =>
        set((s) => ({
          horizon,
          loading: meta.loading ?? false,
          offline: meta.offline ?? s.offline,
          sample: meta.sample ?? horizon?.sample ?? false,
          error: meta.error === undefined ? s.error : meta.error,
          lastHorizon: horizon && !horizon.sample ? horizon : s.lastHorizon,
        })),
      setLoading: (loading) => set({ loading }),
      setOffline: (offline) => set({ offline }),
      setError: (error) => set({ error }),
      setSignalFilter: (k, v) => set((s) => ({ signalFilter: { ...s.signalFilter, [k]: v } })),
      setMapLayer: (k, v) => set((s) => ({ mapLayers: { ...s.mapLayers, [k]: v } })),
      setLang: (lang) => set({ lang }),
      setBackendUrl: (backendUrl) => set({ backendUrl }),
      setMuted: (muted) => set({ muted }),
      setPitch3d: (pitch3d) => set({ pitch3d }),
      setShowPazp: (showPazp) => set({ showPazp }),
      setShowTracks: (showTracks) => set({ showTracks }),
      setShowCivAdsb: (showCivAdsb) => set({ showCivAdsb }),
      setShowMilAdsb: (showMilAdsb) => set({ showMilAdsb }),
      setShowNeptun: (showNeptun) => set({ showNeptun }),
      setShowUaAlerts: (showUaAlerts) => set({ showUaAlerts }),
      setLabelDensity: (labelDensity) => set({ labelDensity }),
      setPlaces: (places) => set({ places }),
      setHomeVoiv: (homeVoiv) => set({ homeVoiv }),
      setDrawer: (drawer) => set({ drawer }),
      setSelectedVoiv: (selectedVoiv) => set({ selectedVoiv }),
      setHoverVoiv: (hoverVoiv) => set({ hoverVoiv }),
      setCameraPreset: (cameraPreset) => set({ cameraPreset, cameraNonce: Date.now() }),
      bumpCamera: () => set({ cameraNonce: Date.now() }),
      setLiveState: (state) => set({ state, stateAt: Date.now(), connecting: false, offline: false }),
      setConnecting: (connecting) => set({ connecting }),
      setHistory: (history) => set({ history }),
      setHistoryMode: (historyMode) => set({ historyMode, historyPlaying: false }),
      setHistoryIdx: (historyIdx) => set({ historyIdx }),
      setHistoryPlaying: (historyPlaying) => set({ historyPlaying }),
      setHistorySpeed: (historySpeed) => set({ historySpeed }),
      setSiren: (sirenOn, sirenVoiv = null) => set({ sirenOn, sirenVoiv }),
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
        lang: s.lang,
        backendUrl: s.backendUrl,
        muted: s.muted,
        pitch3d: s.pitch3d,
        showPazp: s.showPazp,
        showTracks: s.showTracks,
        showCivAdsb: s.showCivAdsb,
        showMilAdsb: s.showMilAdsb,
        showNeptun: s.showNeptun,
        showUaAlerts: s.showUaAlerts,
        labelDensity: s.labelDensity,
        places: s.places,
        homeVoiv: s.homeVoiv,
      }),
      onRehydrateStorage: () => (s) => {
        if (s?.lastHorizon?.sample) s.cacheHorizon(null);
      },
    }
  )
);

export function areaRoleLabel(role: AreaRole): string {
  return { dom: "dom", praca: "praca", rodzina: "rodzina", inne: "inne" }[role];
}
