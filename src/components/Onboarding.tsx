import { useState } from "react";
import { useStore } from "../store";
import { t } from "../i18n";

const VOIV = [
  "dolnoslaskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "lodzkie",
  "malopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "slaskie",
  "swietokrzyskie",
  "warminsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
];

export function Onboarding() {
  const lang = useStore((s) => s.lang);
  const done = useStore((s) => s.onboardingDone);
  const complete = useStore((s) => s.completeOnboarding);
  const state = useStore((s) => s.state);
  const [step, setStep] = useState(0);
  const [voiv, setVoiv] = useState("lubelskie");
  if (done) return null;

  const names = Object.fromEntries((state?.voivodeships ?? []).map((v) => [v.id, lang === "en" ? v.nameEn : v.name]));

  return (
    <aside className="onboard panel panel-ornament" role="dialog" aria-labelledby="onb-title">
      <div className="steps" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`step-dot ${i <= step ? "on" : ""}`} />
        ))}
      </div>
      <div className="sheet-body stack">
        {step === 0 && (
          <>
            <h2 id="onb-title">{t(lang, "onboard1Title")}</h2>
            <p className="muted">{t(lang, "disclaimerFull")}</p>
          </>
        )}
        {step === 1 && (
          <>
            <h2 id="onb-title">{t(lang, "onboard2Title")}</h2>
            <p className="muted">{t(lang, "onboard2Body")}</p>
            <label className="field">
              {t(lang, "voivodeship")}
              <select value={voiv} onChange={(e) => setVoiv(e.target.value)}>
                {VOIV.map((id) => (
                  <option key={id} value={id}>
                    {names[id] ?? id}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <h2 id="onb-title">{t(lang, "onboard3Title")}</h2>
            <p className="muted">{t(lang, "onboard3Body")}</p>
          </>
        )}
        <div className="row space">
          {step === 0 ? (
            <button className="ghost" onClick={() => complete(voiv, false)}>
              {t(lang, "onboardCta")}
            </button>
          ) : (
            <button className="ghost" onClick={() => setStep(step - 1)}>
              {t(lang, "back")}
            </button>
          )}
          {step < 2 ? (
            <button className="primary" onClick={() => setStep(step + 1)}>
              {t(lang, "next")}
            </button>
          ) : (
            <div className="row">
              <button className="ghost" onClick={() => complete(voiv, false)}>
                {t(lang, "skip")}
              </button>
              <button
                className="primary"
                onClick={async () => {
                  let notify = false;
                  if ("Notification" in window) {
                    const p = await Notification.requestPermission();
                    notify = p === "granted";
                  }
                  complete(voiv, notify);
                }}
              >
                {t(lang, "onboardCta")}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
