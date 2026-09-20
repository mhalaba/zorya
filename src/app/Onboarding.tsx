import { useEffect, useState } from "react";
import type { AreaRef, AreaRole, WatchedArea } from "../model";
import { s } from "../strings";
import { searchAreas, SAMPLE_AREAS } from "../api";
import { useStore } from "../store";
import { Toggle } from "../components/ui";

export function Onboarding() {
  const complete = useStore((x) => x.completeOnboarding);
  const setNotify = useStore((x) => x.setNotify);
  const notifyOstrzezenie = useStore((x) => x.notifyOstrzezenie);
  const notifyObserwacja = useStore((x) => x.notifyObserwacja);
  const notifyOdwolanie = useStore((x) => x.notifyOdwolanie);
  const [step, setStep] = useState(0);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<WatchedArea[]>([]);
  const [hint, setHint] = useState<AreaRef | null>(SAMPLE_AREAS[0] ?? null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setHint(SAMPLE_AREAS[0] ?? null),
      () => undefined,
      { timeout: 3000 }
    );
  }, []);

  const results = searchAreas(q);

  async function finish(grant: boolean) {
    let ok = grant;
    if (grant && "Notification" in window) {
      const perm = await Notification.requestPermission();
      ok = perm === "granted";
    }
    const areas = picked.length ? picked : hint ? [{ area: hint, role: "dom" as AreaRole, primary: true }] : [];
    complete(areas, ok);
  }

  return (
    <div className="onboard">
      <a className="brand" href="/" aria-label={s("header.home_a11y")}>
        <img className="mark" src="/icons/zorya-mark-mono.svg" alt="" />
        <span className="wm">{s("brand.wordmark")}</span>
      </a>
      {step === 0 && (
        <>
          <h1>{s("onboarding.q_area")}</h1>
          <div className="field">
            <label>{s("settings.area_search")}</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="list">
            {hint && (
              <button
                type="button"
                className="li"
                onClick={() => setPicked([{ area: hint, role: "dom", primary: true }])}
              >
                <span className="t">{hint.name}</span>
                <span className="d">{s("onboarding.from_device")}</span>
              </button>
            )}
            {results.map((a) => (
              <button
                type="button"
                className="li"
                key={a.id}
                onClick={() =>
                  setPicked((prev) => {
                    if (prev.some((p) => p.area.id === a.id) || prev.length >= 5) return prev;
                    return [...prev, { area: a, role: "dom", primary: prev.length === 0 }];
                  })
                }
              >
                <span className="t">{a.name}</span>
                <span className="d">{a.kind}</span>
              </button>
            ))}
          </div>
          {picked.length > 0 && (
            <p className="note">
              {picked.map((p) => p.area.name).join(" · ")}
            </p>
          )}
          <button type="button" className="btn primary block" disabled={picked.length === 0 && !hint} onClick={() => setStep(1)}>
            {s("onboarding.next")}
          </button>
        </>
      )}
      {step === 1 && (
        <>
          <h1>{s("onboarding.q_wake")}</h1>
          <div className="list">
            <div className="li">
              <span className="t">{s("settings.n_alarm")}</span>
              <span className="d">{s("settings.alarm_locked")}</span>
              <Toggle on locked label={s("settings.n_alarm")} />
            </div>
            <div className="li">
              <span className="t">{s("settings.n_ostrzezenie")}</span>
              <Toggle on={notifyOstrzezenie} onChange={(v) => setNotify("ostrzezenie", v)} label={s("settings.n_ostrzezenie")} />
            </div>
            <div className="li">
              <span className="t">{s("settings.n_obserwacja")}</span>
              <Toggle on={notifyObserwacja} onChange={(v) => setNotify("obserwacja", v)} label={s("settings.n_obserwacja")} />
            </div>
            <div className="li">
              <span className="t">{s("settings.n_odwolanie")}</span>
              <Toggle on={notifyOdwolanie} onChange={(v) => setNotify("odwolanie", v)} label={s("settings.n_odwolanie")} />
            </div>
          </div>
          <button type="button" className="btn primary block" onClick={() => setStep(2)}>
            {s("onboarding.next")}
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <h1>{s("onboarding.q_permission")}</h1>
          <p className="note">{s("onboarding.permission_note")}</p>
          <button type="button" className="btn primary block" onClick={() => void finish(true)}>
            {s("onboarding.q_permission")}
          </button>
          <button type="button" className="btn block" onClick={() => void finish(false)}>
            {s("onboarding.skip")}
          </button>
        </>
      )}
    </div>
  );
}
