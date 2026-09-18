import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FusionState, HistoryBundle, Lang, Place, ViewId } from "./types";

export type Drawer =
  | { kind: "source"; id: string }
  | { kind: "legend" }
  | { kind: "object"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "cameras" }
  | { kind: "adsb"; id: string }
  | { kind: "voiv"; id: string }
  | null;

interface SettingsSlice {
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
  onboardingDone: boolean;
  notifyOn: boolean;
}

interface LiveSlice {
  view: ViewId;
  settingsOpen: boolean;
  drawer: Drawer;
  selectedVoiv: string | null;
  hoverVoiv: string | null;
  cameraPreset: "default" | "region" | "pl" | "flank";
  cameraNonce: number;
  state: FusionState | null;
  stateAt: number | null;
  connecting: boolean;
  offline: boolean;
  historyMode: boolean;
  history: HistoryBundle | null;
  historyIdx: number;
  historyPlaying: boolean;
  historySpeed: 1 | 4 | 12;
  sirenOn: boolean;
  sirenVoiv: string | null;
}

interface Actions {
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
  completeOnboarding: (voiv: string | null, notify: boolean) => void;
  setView: (view: ViewId) => void;
  setSettingsOpen: (v: boolean) => void;
  setDrawer: (d: Drawer) => void;
  setSelectedVoiv: (id: string | null) => void;
  setHoverVoiv: (id: string | null) => void;
  setCameraPreset: (p: LiveSlice["cameraPreset"]) => void;
  bumpCamera: () => void;
  setLiveState: (s: FusionState) => void;
  setConnecting: (v: boolean) => void;
  setOffline: (v: boolean) => void;
  setHistory: (h: HistoryBundle | null) => void;
  setHistoryMode: (v: boolean) => void;
  setHistoryIdx: (i: number) => void;
  setHistoryPlaying: (v: boolean) => void;
  setHistorySpeed: (s: 1 | 4 | 12) => void;
  setSiren: (on: boolean, voiv?: string | null) => void;
}

export type Store = SettingsSlice & LiveSlice & Actions;

export const useStore = create<Store>()(
  persist(
    (set) => ({
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
      onboardingDone: false,
      notifyOn: false,
      view: "map",
      settingsOpen: false,
      drawer: null,
      selectedVoiv: null,
      hoverVoiv: null,
      cameraPreset: "default",
      cameraNonce: 0,
      state: null,
      stateAt: null,
      connecting: true,
      offline: false,
      historyMode: false,
      history: null,
      historyIdx: 0,
      historyPlaying: false,
      historySpeed: 1,
      sirenOn: false,
      sirenVoiv: null,
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
      completeOnboarding: (voiv, notify) =>
        set({
          onboardingDone: true,
          homeVoiv: voiv,
          selectedVoiv: voiv,
          notifyOn: notify,
          cameraPreset: voiv ? "region" : "default",
          cameraNonce: Date.now(),
        }),
      setView: (view) => set({ view }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setDrawer: (drawer) => set({ drawer }),
      setSelectedVoiv: (selectedVoiv) => set({ selectedVoiv }),
      setHoverVoiv: (hoverVoiv) => set({ hoverVoiv }),
      setCameraPreset: (cameraPreset) => set({ cameraPreset, cameraNonce: Date.now() }),
      bumpCamera: () => set({ cameraNonce: Date.now() }),
      setLiveState: (state) => set({ state, stateAt: Date.now(), connecting: false, offline: false }),
      setConnecting: (connecting) => set({ connecting }),
      setOffline: (offline) => set({ offline }),
      setHistory: (history) => set({ history }),
      setHistoryMode: (historyMode) => set({ historyMode, historyPlaying: false }),
      setHistoryIdx: (historyIdx) => set({ historyIdx }),
      setHistoryPlaying: (historyPlaying) => set({ historyPlaying }),
      setHistorySpeed: (historySpeed) => set({ historySpeed }),
      setSiren: (sirenOn, sirenVoiv = null) => set({ sirenOn, sirenVoiv }),
    }),
    {
      name: "zorya-local",
      partialize: (s) => ({
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
        onboardingDone: s.onboardingDone,
        notifyOn: s.notifyOn,
      }),
    }
  )
);
