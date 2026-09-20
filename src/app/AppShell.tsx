import { useEffect, useState } from "react";
import type { NavId } from "../model";
import { activeScenario, fetchHorizon, SAMPLE_AREAS } from "../api";
import { fmtTime } from "../format";
import { s } from "../strings";
import { useStore } from "../store";
import { AppHeader, BottomNav, OfflineBar } from "../components/Chrome";
import { AreaSheet, FilterSheet, Horyzont } from "./Horyzont";
import { Zdarzenie } from "./Zdarzenie";
import { Mapa } from "./Mapa";
import { Sygnaly, Zrodlo } from "./Sygnaly";
import { Zglos } from "./Zglos";
import { Wiecej } from "./Wiecej";
import { Onboarding } from "./Onboarding";
import { maybeNotify } from "../notify";

export function AppShell({ path }: { path: string }) {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());
  const onboardingDone = useStore((x) => x.onboardingDone);
  const completeOnboarding = useStore((x) => x.completeOnboarding);
  const selectedAreaId = useStore((x) => x.selectedAreaId);
  const setHorizon = useStore((x) => x.setHorizon);
  const setOffline = useStore((x) => x.setOffline);
  const offline = useStore((x) => x.offline);
  const horizon = useStore((x) => x.horizon);
  const lastHorizon = useStore((x) => x.lastHorizon);
  const cacheHorizon = useStore((x) => x.cacheHorizon);
  const error = useStore((x) => x.error);
  const setError = useStore((x) => x.setError);

  const parts = path.replace(/\/$/, "").split("/").filter(Boolean);
  const rest = parts.slice(1);
  let view: NavId = "horyzont";
  if (rest[0] === "mapa") view = "mapa";
  else if (rest[0] === "sygnaly") view = "sygnaly";
  else if (rest[0] === "zglos") view = "zglos";
  else if (rest[0] === "wiecej") view = "wiecej";
  else if (rest[0] === "zdarzenie") view = "horyzont";

  useEffect(() => {
    if (useStore.persist.hasHydrated()) setHydrated(true);
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (activeScenario() && SAMPLE_AREAS[0]) {
      const cur = useStore.getState();
      if (!cur.onboardingDone || cur.areas.length === 0) {
        const seeded = [
          { area: SAMPLE_AREAS[0], role: "dom" as const, primary: true },
          ...(SAMPLE_AREAS[1] ? [{ area: SAMPLE_AREAS[1], role: "praca" as const, primary: false }] : []),
        ];
        completeOnboarding(seeded, true);
      }
    }
  }, [completeOnboarding, hydrated]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const h = await fetchHorizon(selectedAreaId);
        if (stop) return;
        const sc = activeScenario();
        setHorizon(h, { sample: h.sample, offline: sc === "offline", loading: false, error: null });
        cacheHorizon(h);
        maybeNotify(h);
      } catch {
        if (stop) return;
        const cached = useStore.getState().lastHorizon;
        if (cached) {
          setHorizon(cached, { offline: true, loading: false, sample: cached.sample, error: null });
        } else {
          setError("horizon");
          setHorizon(null, { offline: true, loading: false, error: "horizon" });
        }
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    const onOffline = () => setOffline(true);
    const onOnline = () => {
      setOffline(false);
      void load();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (!navigator.onLine || activeScenario() === "offline") setOffline(true);
    return () => {
      stop = true;
      window.clearInterval(t);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [selectedAreaId, cacheHorizon, setHorizon, setOffline, setError]);

  const level = horizon?.status.level ?? lastHorizon?.status.level ?? "cisza";
  const dataTime = horizon?.status.data_as_of ?? lastHorizon?.status.data_as_of;

  if (!hydrated) {
    return <div className="app-root" />;
  }

  if (!onboardingDone) {
    return (
      <div className="app-root">
        <Onboarding />
      </div>
    );
  }

  return (
    <div className="app-root">
      <AppHeader level={level} />
      {(offline || activeScenario() === "offline") && dataTime && <OfflineBar time={fmtTime(dataTime)} />}
      {error && (
        <p className="offline-bar">
          {s("states.error", { thing: "horyzont", time: dataTime ? fmtTime(dataTime) : "—" })}{" "}
          <button type="button" className="linkish" onClick={() => window.location.reload()}>
            {s("states.retry")}
          </button>
        </p>
      )}
      {view === "mapa" ? (
        <Mapa />
      ) : rest[0] === "zdarzenie" && rest[1] ? (
        <Zdarzenie id={rest[1]} />
      ) : (
        <main>
          {rest[0] === "sygnaly" && rest[1] ? (
            <Zrodlo id={rest[1]} />
          ) : view === "sygnaly" ? (
            <Sygnaly />
          ) : view === "zglos" ? (
            <Zglos />
          ) : view === "wiecej" ? (
            <Wiecej />
          ) : (
            <Horyzont />
          )}
        </main>
      )}
      <FilterSheet />
      <AreaSheet />
      <BottomNav current={view} />
    </div>
  );
}
