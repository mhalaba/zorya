import { useEffect, useRef, useState } from "react";
import { MapCanvas } from "./map/MapCanvas";
import { TopBar, Ticker, Dock, Fabs, DisclaimerLine, HoverTip, StatusBanners } from "./components/Chrome";
import { Onboarding } from "./components/Onboarding";
import { Drawers } from "./components/Drawers";
import { SignalsView } from "./components/Signals";
import { HistoryView } from "./components/History";
import { MoreView } from "./components/More";
import { SettingsView } from "./components/Settings";
import { useStore } from "./store";
import { fetchState, openStateSocket } from "./api";
import { t } from "./i18n";
import { playWatch, startSiren, stopSiren } from "./audio";
import { syncPushSubscription } from "./push";
import type { FusionState } from "./types";

const lastPing = new Map<string, number>();

export function App() {
  const lang = useStore((s) => s.lang);
  const view = useStore((s) => s.view);
  const backendUrl = useStore((s) => s.backendUrl);
  const setLive = useStore((s) => s.setLiveState);
  const setConnecting = useStore((s) => s.setConnecting);
  const setOffline = useStore((s) => s.setOffline);
  const setDrawer = useStore((s) => s.setDrawer);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const sirenOn = useStore((s) => s.sirenOn);
  const sirenVoiv = useStore((s) => s.sirenVoiv);
  const setSiren = useStore((s) => s.setSiren);
  const muted = useStore((s) => s.muted);
  const places = useStore((s) => s.places);
  const homeVoiv = useStore((s) => s.homeVoiv);
  const notifyOn = useStore((s) => s.notifyOn);
  const state = useStore((s) => s.state);
  const [now, setNow] = useState(Date.now());
  const installRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "en" ? "Zorya — dawn watch" : "Zorya — czuwanie świtu";
  }, [lang]);

  useEffect(() => {
    const tmr = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tmr);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(null);
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDrawer, setSettingsOpen]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      installRef.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: number | undefined;
    setConnecting(true);

    const load = () =>
      fetchState(backendUrl)
        .then((s) => {
          if (!closed) setLive(s);
        })
        .catch(() => {
          if (!closed) setOffline(true);
        });

    // Reconnect with backoff (1 s … 30 s): a server restart or a network switch must not end the watch.
    const reconnectLater = () => {
      if (closed) return;
      setOffline(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void load();
        connect();
      }, Math.min(30_000, 1000 * 2 ** retry++));
    };

    const connect = () => {
      if (closed) return;
      const old = ws;
      ws = null;
      old?.close();
      const sock = openStateSocket(
        backendUrl,
        (s) => {
          retry = 0;
          setLive(s);
        },
        () => {
          // Only the current socket may schedule a reconnect; a late close of a replaced one is ignored.
          if (sock === ws) reconnectLater();
        }
      );
      ws = sock;
      if (!sock) setOffline(true);
    };

    // Back from background / network: try right away instead of waiting out the backoff.
    const wake = () => {
      if (closed || document.hidden) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      retry = 0;
      reconnectLater();
    };

    void load();
    connect();
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      closed = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      ws?.close();
    };
  }, [backendUrl, setConnecting, setLive, setOffline]);

  useEffect(() => {
    if (!state) return;
    maybeNotify(state, { places, homeVoiv, notifyOn, muted, lang });
  }, [state, places, homeVoiv, notifyOn, muted, lang]);

  useEffect(() => {
    void syncPushSubscription();
  }, [notifyOn, places, homeVoiv, lang, backendUrl]);

  useEffect(() => {
    if (sirenOn && !muted) startSiren();
    else stopSiren();
    return () => stopSiren();
  }, [sirenOn, muted]);

  const voivName = state?.voivodeships.find((v) => v.id === sirenVoiv);

  return (
    <div className="app">
      <MapCanvas />
      <TopBar
        onInstall={async () => {
          if (installRef.current) {
            await installRef.current.prompt();
            installRef.current = null;
          } else {
            alert(t(lang, "installHint"));
          }
        }}
      />
      <Ticker now={now} />
      <StatusBanners now={now} />
      <HoverTip />
      <Fabs />
      <DisclaimerLine />
      {view === "signals" && <SignalsView now={now} />}
      {view === "history" && <HistoryView />}
      {view === "more" && <MoreView />}
      <SettingsView />
      <Drawers now={now} />
      <Onboarding />
      <Dock />
      {sirenOn && (
        <div className="priority" role="alertdialog">
          <div className="priority-card panel">
            <h2>{t(lang, "levelPriority")}</h2>
            <p>{voivName ? (lang === "en" ? voivName.nameEn : voivName.name) : ""}</p>
            <p>{t(lang, "priorityDo")}</p>
            <p className="tiny">{t(lang, "disclaimerFull")}</p>
            <button
              className="ack"
              onClick={() => {
                setSiren(false);
                stopSiren();
              }}
            >
              {t(lang, "ack")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function maybeNotify(
  state: FusionState,
  opts: { places: { voivodeship: string; notifyWatch: boolean; notifyPriority: boolean; name: string }[]; homeVoiv: string | null; notifyOn: boolean; muted: boolean; lang: "pl" | "en" }
) {
  const watched = new Set(opts.places.map((p) => p.voivodeship));
  if (opts.homeVoiv) watched.add(opts.homeVoiv);
  const now = Date.now();
  for (const v of state.voivodeships) {
    if (!watched.has(v.id)) continue;
    const place = opts.places.find((p) => p.voivodeship === v.id);
    const wantWatch = place ? place.notifyWatch : true;
    const wantPri = place ? place.notifyPriority : true;
    if (v.level === "priority" && wantPri) {
      const key = `${v.id}-priority`;
      if ((lastPing.get(key) ?? 0) > now - 10 * 60 * 1000) continue;
      lastPing.set(key, now);
      useStore.getState().setSiren(true, v.id);
    } else if (v.level === "watch" && wantWatch) {
      // Points drift every cycle, so they must not be part of the cooldown key.
      const key = `${v.id}-watch`;
      if ((lastPing.get(key) ?? 0) > now - 10 * 60 * 1000) continue;
      lastPing.set(key, now);
      if (!opts.muted) playWatch();
    }
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
