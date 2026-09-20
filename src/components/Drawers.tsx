import { X } from "lucide-react";
import { useStore } from "../store";
import { t } from "../i18n";
import { SOURCE_LABEL, OBJECT_LABEL, COLORS } from "../config";
import { ageLabel, ageSeconds, fmtPts, nearestPlaceDist } from "../lib";
import type { Breakdown } from "../types";

export function Drawers({ now }: { now: number }) {
  const drawer = useStore((s) => s.drawer);
  const setDrawer = useStore((s) => s.setDrawer);
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  if (!drawer || !state) return null;

  const close = () => setDrawer(null);

  if (drawer.kind === "source") {
    const src = state.sources.find((s) => s.id === drawer.id);
    if (!src) return null;
    return (
      <aside className="drawer panel panel-ornament">
        <Head title={SOURCE_LABEL[src.id]?.[lang] ?? src.id} onClose={close} />
        <div className="drawer-body stack">
          <p>
            {t(lang, "heartbeat")}: {src.age_s}s
          </p>
          <p>
            {t(lang, "error")}: {src.ok ? t(lang, "none") : src.message}
          </p>
          <p>
            {t(lang, "records")}: {src.records}
          </p>
          <p className="muted">{src.message}</p>
          {src.id === "neptun" && <p className="tiny">{t(lang, "neptunNote")}</p>}
        </div>
      </aside>
    );
  }

  if (drawer.kind === "legend") {
    return (
      <aside className="drawer panel panel-ornament">
        <Head title={t(lang, "legend")} onClose={close} />
        <div className="drawer-body stack">
          <p className="tiny">{t(lang, "legendBody")}</p>
          <div className="scale">
            <span className="swatch" style={{ background: COLORS.navy }} />
            <span>0.0–1.9 · {t(lang, "levelInfo")}</span>
            <span className="swatch" style={{ background: COLORS.amber, opacity: 0.7 }} />
            <span>2.0–3.9 · {t(lang, "levelWatch")}</span>
            <span className="swatch" style={{ background: COLORS.crimson, opacity: 0.8 }} />
            <span>≥4.0 · {t(lang, "levelPriority")}</span>
            <span className="swatch" style={{ background: COLORS.olive, opacity: 0.7 }} />
            <span>{t(lang, "oliveNote")}</span>
          </div>
          <p className="tiny">{t(lang, "neptunNote")}</p>
          <div className="stack">
            {["shahed", "drone", "cruise", "ballistic", "aircraft", "helicopter", "unknown"].map((k) => (
              <div key={k} className="icon-row">
                <span className="obj-glyph" aria-hidden />
                <span>{OBJECT_LABEL[k]?.[lang] ?? k}</span>
              </div>
            ))}
            <div className="icon-row">
              <span className="swatch" style={{ background: "#8FA0B3" }} />
              <span>
                {t(lang, "adsbCiv")} · {t(lang, "adsbZero")}
              </span>
            </div>
            <div className="icon-row">
              <span className="swatch" style={{ background: COLORS.cyan }} />
              <span>
                {t(lang, "adsbMil")} · {t(lang, "adsbZero")}
              </span>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (drawer.kind === "object") {
    const o = state.objects.find((x) => x.id === drawer.id);
    if (!o) return null;
    const age = ageSeconds(o.ts, now);
    return (
      <aside className="drawer panel panel-ornament">
        <Head title={o.title} onClose={close} />
        <div className="drawer-body stack">
          <p>
            {OBJECT_LABEL[o.type]?.[lang]} · NEPTUN
          </p>
          <p className="tiny">{t(lang, "neptunNote")}</p>
          <p>
            {t(lang, "confidence")}: {(o.confidence * 100).toFixed(0)}% · ±{o.unc_km} km
          </p>
          <p>
            {t(lang, "confirmations")}: {o.confirmations}
          </p>
          <p>
            {t(lang, "distBorder")}: {o.dist_pl_km} km
          </p>
          <p>
            {t(lang, "azimuth")}: {o.azimuth_pl}°
          </p>
          <PlaceDist lat={o.lat} lon={o.lon} lang={lang} />
          <p>
            ETA: {o.eta_min != null ? `${o.eta_min} min` : t(lang, "none")}
            <span className="tiny"> — {t(lang, "etaNote")}</span>
          </p>
          <p>
            {t(lang, "update")}: {ageLabel(age, lang)} {t(lang, "ago")}
          </p>
          <div>
            <div className="tiny">{t(lang, "contrib")}</div>
            {o.points_contrib.length === 0 && <p className="muted">0 {t(lang, "pts")} ({o.observation ? ">250 km" : "—"})</p>}
            {o.points_contrib.map((c) => {
              const v = state.voivodeships.find((x) => x.id === c.id);
              return (
                <div key={c.id} className="row space">
                  <span>{lang === "en" ? v?.nameEn : v?.name}</span>
                  <span className="tabular">{fmtPts(c.points, lang)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  if (drawer.kind === "zone") {
    const z = state.zones.find((x) => x.id === drawer.id);
    if (!z) return null;
    return (
      <aside className="drawer panel panel-ornament">
        <Head title={`${z.type} ${z.code}`} onClose={close} />
        <div className="drawer-body stack">
          <p>
            {z.from} — {z.to}
          </p>
          <p>
            {t(lang, "zoneScores")}: {z.scores ? t(lang, "yes") : t(lang, "no")}
          </p>
          <p className="muted">
            {t(lang, "why")}: {z.reason}
          </p>
        </div>
      </aside>
    );
  }

  if (drawer.kind === "cameras") {
    return (
      <aside className="drawer panel panel-ornament">
        <Head title={t(lang, "cameras")} onClose={close} />
        <div className="drawer-body stack">
          <p className="tiny">{t(lang, "camerasNote")}</p>
          <div className="cameras">
            {state.cameras.map((c) => (
              <div key={c.id} className="cam-tile">
                {c.name} · {t(lang, "noStream")}
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  if (drawer.kind === "adsb") {
    const a = state.adsb.find((x) => x.id === drawer.id);
    if (!a) return null;
    return (
      <aside className="drawer panel panel-ornament">
        <Head title={a.callsign} onClose={close} />
        <div className="drawer-body stack">
          <p>{a.mil ? t(lang, "adsbMil") : t(lang, "adsbCiv")}</p>
          <p className="tiny">{t(lang, "adsbZero")}</p>
          <p>{a.type || t(lang, "none")}</p>
          <p>
            {a.alt_ft} ft · {Math.round(a.speed_kt)} kt · {Math.round(a.heading)}°
          </p>
        </div>
      </aside>
    );
  }

  if (drawer.kind === "voiv") {
    const v = state.voivodeships.find((x) => x.id === drawer.id);
    if (!v) return null;
    return (
      <aside className="drawer panel panel-ornament">
        <Head title={lang === "en" ? v.nameEn : v.name} onClose={close} />
        <div className="drawer-body stack">
          <VoivBody v={v} lang={lang} now={now} />
        </div>
      </aside>
    );
  }

  return null;
}

function PlaceDist({ lat, lon, lang }: { lat: number; lon: number; lang: "pl" | "en" }) {
  const places = useStore((s) => s.places);
  const d = nearestPlaceDist(places, lat, lon);
  if (!d) {
    if (!places.length) return null;
    return <p className="tiny">{t(lang, "gpsNeed")}</p>;
  }
  return (
    <p>
      {d.km} km {t(lang, "fromPlace")} {d.name}, {t(lang, "azimuth")} {d.az}°
    </p>
  );
}

function Head({ title, onClose }: { title: string; onClose: () => void }) {
  const lang = useStore((s) => s.lang);
  return (
    <div className="drawer-head">
      <h2>{title}</h2>
      <button className="icon-btn" onClick={onClose} aria-label={t(lang, "close")}>
        <X size={18} />
      </button>
    </div>
  );
}

export function VoivBody({
  v,
  lang,
  now,
}: {
  v: {
    id: string;
    name: string;
    nameEn: string;
    points: number;
    own: number;
    transfer: number;
    level: string;
    paint: string;
    breakdown: Breakdown;
    transferred_from: { id: string; name: string; points: number }[];
    whyPl?: string;
    whyEn?: string;
  };
  lang: "pl" | "en";
  now: number;
}) {
  const state = useStore((s) => s.state);
  const lvl = v.level === "priority" ? t(lang, "levelPriority") : v.level === "watch" ? t(lang, "levelWatch") : t(lang, "levelInfo");
  const sigs = (state?.signals ?? []).filter((s) => s.voivodeships.includes(v.id));
  const sum = Object.values(v.breakdown).reduce((a, b) => a + b, 0) || 1;
  return (
    <>
      <div className="row space">
        <strong className="tabular">
          {fmtPts(v.points, lang)} {t(lang, "pts")}
        </strong>
        <span>{lvl}</span>
      </div>
      {(lang === "en" ? v.whyEn : v.whyPl) ? (
        <p>
          {lang === "en" ? v.whyEn : v.whyPl}
        </p>
      ) : null}
      <div className="bar" aria-hidden>
        <span className="neptun" style={{ width: `${(v.breakdown.neptun / sum) * 100}%` }} />
        <span className="ua" style={{ width: `${(v.breakdown.ua / sum) * 100}%` }} />
        <span className="rcb" style={{ width: `${(v.breakdown.rcb / sum) * 100}%` }} />
        <span className="media" style={{ width: `${(v.breakdown.media / sum) * 100}%` }} />
        <span className="pazp" style={{ width: `${(v.breakdown.pazp / sum) * 100}%` }} />
        <span className="other" style={{ width: `${(v.breakdown.other / sum) * 100}%` }} />
      </div>
      <div className="tiny">
        NEPTUN {fmtPts(v.breakdown.neptun, lang)} · UA {fmtPts(v.breakdown.ua, lang)} · RCB {fmtPts(v.breakdown.rcb, lang)} · RSS {fmtPts(v.breakdown.media, lang)} · PAŻP {fmtPts(v.breakdown.pazp, lang)} · {lang === "en" ? "other" : "inne"} {fmtPts(v.breakdown.other, lang)}
      </div>
      {v.transferred_from.map((tr) => (
        <p key={tr.id} className="tiny">
          {t(lang, "transferFrom")} {tr.name} · {fmtPts(tr.points, lang)}
        </p>
      ))}
      {sigs.length === 0 && <p className="muted">{t(lang, "emptySignals")}</p>}
      {sigs.map((s) => {
        const age = ageSeconds(s.ts, now);
        return (
          <div key={s.id} className={`sig ${s.weight < 0.35 ? "dim" : ""}`}>
            <span className="dot ok" />
            <div>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              ) : (
                s.title
              )}
              <div className="tiny">
                {s.source} · {t(lang, "update")} {ageLabel(age, lang)} · {t(lang, "weight")} {s.weight.toFixed(2)}
              </div>
            </div>
            <span className="tabular">{fmtPts(s.points, lang)}</span>
          </div>
        );
      })}
    </>
  );
}
