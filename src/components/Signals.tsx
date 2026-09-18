import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../store";
import { t } from "../i18n";
import { EAST_IDS } from "../config";
import { fmtPts, nearestPlaceDist } from "../lib";
import { VoivBody } from "./Drawers";

export function SignalsView({ now }: { now: number }) {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const setView = useStore((s) => s.setView);
  const places = useStore((s) => s.places);
  const setDrawer = useStore((s) => s.setDrawer);
  const [watch, setWatch] = useState(false);
  const [east, setEast] = useState(false);
  const [neptun, setNeptun] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const rows = [...(state?.voivodeships ?? [])];
    rows.sort((a, b) => b.points - a.points || a.eastRank - b.eastRank);
    return rows.filter((v) => {
      // Level too: an RCB alert is priority even below 2 points.
      if (watch && v.level === "info" && v.points < 2) return false;
      if (east && !EAST_IDS.includes(v.id) && v.eastRank > 4) return false;
      if (neptun && v.breakdown.neptun <= 0) return false;
      return true;
    });
  }, [state, watch, east, neptun]);

  const placeIds = new Set(places.map((p) => p.voivodeship));
  const pinned = list.filter((v) => placeIds.has(v.id));
  const rest = list.filter((v) => !placeIds.has(v.id));
  const near = (state?.objects ?? []).filter((o) => !o.observation);
  const far = (state?.objects ?? []).filter((o) => o.observation);
  const placesGps = places;

  function objLabel(o: (typeof near)[number]) {
    const d = nearestPlaceDist(placesGps, o.lat, o.lon);
    if (!d) return o.title;
    return `${o.title} · ${d.km} km ${t(lang, "fromPlace")} ${d.name}, ${d.az}°`;
  }

  return (
    <section className="sheet panel panel-ornament">
      <div className="sheet-head">
        <h2>{t(lang, "signals")}</h2>
        <button className="icon-btn" onClick={() => setView("map")} aria-label={t(lang, "close")}>
          <X size={18} />
        </button>
      </div>
      <div className="sheet-body stack">
        <div className="chip-row">
          <button className={`chip ${watch ? "on" : ""}`} onClick={() => setWatch(!watch)}>
            {t(lang, "filterWatch")}
          </button>
          <button className={`chip ${east ? "on" : ""}`} onClick={() => setEast(!east)}>
            {t(lang, "filterEast")}
          </button>
          <button className={`chip ${neptun ? "on" : ""}`} onClick={() => setNeptun(!neptun)}>
            {t(lang, "filterNeptun")}
          </button>
        </div>
        {pinned.length > 0 && <p className="tiny">{t(lang, "myPlaces")}</p>}
        <div className="voiv-list">
          {[...pinned, ...rest].map((v) => (
            <div key={v.id}>
              <button className={`voiv-card ${open === v.id ? "open" : ""}`} onClick={() => setOpen(open === v.id ? null : v.id)}>
                <div className="row space">
                  <span>{lang === "en" ? v.nameEn : v.name}</span>
                  <strong className="tabular">
                    {fmtPts(v.points, lang)} {t(lang, "pts")}
                  </strong>
                </div>
                <div className="tiny">
                  {v.level === "priority" ? t(lang, "levelPriority") : v.level === "watch" ? t(lang, "levelWatch") : t(lang, "levelInfo")}
                </div>
              </button>
              {open === v.id && (
                <div style={{ padding: "8px 4px 12px" }}>
                  <VoivBody v={v} lang={lang} now={now} />
                </div>
              )}
            </div>
          ))}
        </div>
        <h3 className="tiny">{t(lang, "objectsNear")}</h3>
        {near.length === 0 && <p className="muted">{t(lang, "none")}</p>}
        {near.map((o) => (
          <button key={o.id} className="voiv-card" onClick={() => setDrawer({ kind: "object", id: o.id })}>
            {objLabel(o)}
          </button>
        ))}
        <h3 className="tiny">{t(lang, "objectsFar")}</h3>
        {far.map((o) => (
          <button key={o.id} className="voiv-card" onClick={() => setDrawer({ kind: "object", id: o.id })}>
            {objLabel(o)} · {o.dist_pl_km} km
          </button>
        ))}
        <h3 className="tiny">{t(lang, "milAir")}</h3>
        {(state?.adsb ?? []).filter((a) => a.mil).map((a) => (
          <button key={a.id} className="voiv-card" onClick={() => setDrawer({ kind: "adsb", id: a.id })}>
            {a.callsign} · {a.type} · {a.alt_ft} ft
          </button>
        ))}
        <h3 className="tiny">
          {t(lang, "civAir")} · {(state?.adsb ?? []).filter((a) => !a.mil).length} · {t(lang, "adsbZero")}
        </h3>
        {(state?.adsb ?? [])
          .filter((a) => !a.mil)
          .sort((a, b) => b.alt_ft - a.alt_ft)
          .slice(0, 24)
          .map((a) => (
            <button key={a.id} className="voiv-card" onClick={() => setDrawer({ kind: "adsb", id: a.id })}>
              {a.callsign} · {a.type || "—"} · {a.alt_ft} ft
            </button>
          ))}
        {(state?.adsb ?? []).filter((a) => !a.mil).length > 24 && (
          <p className="tiny">
            +{(state?.adsb ?? []).filter((a) => !a.mil).length - 24} {t(lang, "adsbMoreOnMap")}
          </p>
        )}
        <h3 className="tiny">{t(lang, "cameras")}</h3>
        <button className="ghost" onClick={() => setDrawer({ kind: "cameras" })}>
          {t(lang, "cameras")} ({state?.cameras.length ?? 0})
        </button>
      </div>
    </section>
  );
}
