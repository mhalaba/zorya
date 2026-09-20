import type { ReactNode } from "react";
import type { Confidence, Level } from "../model";
import { s } from "../strings";

export function LevelGlyph({
  level,
  size = "card",
  breathe = false,
}: {
  level: Level;
  size?: "inline" | "card" | "hero";
  breathe?: boolean;
}) {
  const cls = `lg lg-${level} lg-${size} lvl-${level}${breathe ? " star-breathe" : ""}`;
  return <span className={cls} aria-hidden />;
}

export function ConfidenceRule({
  confidence,
  extra,
}: {
  confidence: Confidence;
  extra?: string;
}) {
  const label = s(`confidence.${confidence}`);
  return (
    <div className={`conf ${confidence}`}>
      <i />
      {extra ? `${label} · ${extra}` : label}
    </div>
  );
}

export function SourceChips({ ids, alarm }: { ids: string[]; alarm?: boolean }) {
  const names: Record<string, string> = {
    rcb: "RCB",
    imgw: "IMGW",
    psp: "PSP",
    syreny: "syreny",
    sdr: "SDR",
    adsb: "SDR",
    radio_ews: "radio",
    zgloszenia: "zgłoszenia",
  };
  return (
    <div className="src">
      {ids.map((id) => (
        <span className="s" key={id}>
          {names[id] ?? id}
        </span>
      ))}
      {alarm ? null : null}
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  locked,
  label,
}: {
  on: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle${on ? " on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={locked}
      onClick={() => {
        if (!locked && onChange) onChange(!on);
      }}
    >
      <i />
    </button>
  );
}

export function HealthDot({ health, time }: { health: string; time: string }) {
  const cls = health === "fresh" ? "ok" : health === "disabled" ? "off" : "warn";
  return (
    <span className={`r health ${cls}`}>
      <b />
      {time}
    </span>
  );
}

export function Eyebrow({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="eyebrow">
      <span className="z-label">{label}</span>
      {action}
    </div>
  );
}

export function HorizonRule() {
  return <div className="horizon" data-label={s("home.horizon")} />;
}

export function PinIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
    </svg>
  );
}

export const NAV_ICONS = {
  horyzont: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 15h18M15 8a2.5 2.5 0 1 1-.01 0" />
    </svg>
  ),
  mapa: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16" />
    </svg>
  ),
  sygnaly: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 18v-5M9 18V6M14 18v-8M19 18V3" />
    </svg>
  ),
  zglos: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  wiecej: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
};

export function SheetFrame({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <button type="button" className="sheet-back" aria-label={s("nav.close")} onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <div className="eyebrow" style={{ padding: 0 }}>
          <h2>{title}</h2>
          <button type="button" className="linkish" onClick={onClose}>
            {s("nav.close")}
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
