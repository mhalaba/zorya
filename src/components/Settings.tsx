import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../store";
import { t } from "../i18n";
import { uid } from "../lib";
import { playTest } from "../audio";
import { isValidBackendUrl } from "../api";
import type { Place } from "../types";

export function SettingsView() {
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const places = useStore((s) => s.places);
  const setPlaces = useStore((s) => s.setPlaces);
  const muted = useStore((s) => s.muted);
  const setMuted = useStore((s) => s.setMuted);
  const pitch3d = useStore((s) => s.pitch3d);
  const setPitch3d = useStore((s) => s.setPitch3d);
  const showTracks = useStore((s) => s.showTracks);
  const setShowTracks = useStore((s) => s.setShowTracks);
  const showCivAdsb = useStore((s) => s.showCivAdsb);
  const showMilAdsb = useStore((s) => s.showMilAdsb);
  const showNeptun = useStore((s) => s.showNeptun);
  const showUaAlerts = useStore((s) => s.showUaAlerts);
  const setShowCivAdsb = useStore((s) => s.setShowCivAdsb);
  const setShowMilAdsb = useStore((s) => s.setShowMilAdsb);
  const setShowNeptun = useStore((s) => s.setShowNeptun);
  const setShowUaAlerts = useStore((s) => s.setShowUaAlerts);
  const labelDensity = useStore((s) => s.labelDensity);
  const setLabelDensity = useStore((s) => s.setLabelDensity);
  const backendUrl = useStore((s) => s.backendUrl);
  const setBackendUrl = useStore((s) => s.setBackendUrl);
  const state = useStore((s) => s.state);
  const setSiren = useStore((s) => s.setSiren);
  const [name, setName] = useState("");
  const [voiv, setVoiv] = useState("lubelskie");
  const [url, setUrl] = useState(backendUrl);
  const [urlInvalid, setUrlInvalid] = useState(false);

  if (!open) return null;

  function saveBackend() {
    const next = url.trim().replace(/\/$/, "");
    // A malformed URL would be persisted and break every reload, so it never reaches the store.
    if (!isValidBackendUrl(next)) {
      setUrlInvalid(true);
      return;
    }
    setUrlInvalid(false);
    setBackendUrl(next);
  }

  function addPlace() {
    if (places.length >= 8 || !name.trim()) return;
    const p: Place = { id: uid(), name: name.trim(), voivodeship: voiv, notifyWatch: true, notifyPriority: true };
    setPlaces([...places, p]);
    setName("");
  }

  function gps(id: string) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // The fix can take seconds; read the current list so edits made meanwhile are kept.
        const current = useStore.getState().places;
        setPlaces(current.map((p) => (p.id === id ? { ...p, lat: pos.coords.latitude, lon: pos.coords.longitude } : p)));
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 }
    );
  }

  return (
    <section className="sheet panel panel-ornament" style={{ zIndex: 32 }}>
      <div className="sheet-head">
        <h2>{t(lang, "settings")}</h2>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t(lang, "close")}>
          <X size={18} />
        </button>
      </div>
      <div className="sheet-body stack">
        <p className="tiny">{t(lang, "placesMax")}</p>
        <p className="tiny">{t(lang, "pushHint")}</p>
        {places.map((p) => (
          <div key={p.id} className="voiv-card">
            <div className="row space">
              <strong>{p.name}</strong>
              <button className="text-btn" onClick={() => setPlaces(places.filter((x) => x.id !== p.id))}>
                {t(lang, "remove")}
              </button>
            </div>
            <div className="tiny">{state?.voivodeships.find((v) => v.id === p.voivodeship)?.[lang === "en" ? "nameEn" : "name"]}</div>
            <label className="row tiny">
              <input type="checkbox" checked={p.notifyWatch} onChange={(e) => setPlaces(places.map((x) => (x.id === p.id ? { ...x, notifyWatch: e.target.checked } : x)))} />
              ≥2
            </label>
            <label className="row tiny">
              <input type="checkbox" checked={p.notifyPriority} onChange={(e) => setPlaces(places.map((x) => (x.id === p.id ? { ...x, notifyPriority: e.target.checked } : x)))} />
              ≥4
            </label>
            <button className="ghost" onClick={() => gps(p.id)}>
              {t(lang, "gpsOnce")} {p.lat ? "✓" : ""}
            </button>
          </div>
        ))}
        {places.length < 8 && (
          <div className="stack">
            <label className="field">
              {t(lang, "placeName")}
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              {t(lang, "voivodeship")}
              <select value={voiv} onChange={(e) => setVoiv(e.target.value)}>
                {(state?.voivodeships ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {lang === "en" ? v.nameEn : v.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="ghost" onClick={addPlace}>
              {t(lang, "addPlace")}
            </button>
          </div>
        )}

        <h3>{t(lang, "sound")}</h3>
        <div className="chip-row">
          <button className="chip" onClick={() => playTest("watch")}>
            {t(lang, "testWatch")}
          </button>
          <button
            className="chip"
            onClick={() => {
              playTest("siren");
              setSiren(true, useStore.getState().homeVoiv);
            }}
          >
            {t(lang, "testSiren")}
          </button>
          <button className="chip" onClick={() => setMuted(!muted)}>
            {muted ? t(lang, "unmute") : t(lang, "mute")}
          </button>
        </div>

        <h3>{t(lang, "mapSettings")}</h3>
        <label className="row">
          <input type="checkbox" checked={pitch3d} onChange={(e) => setPitch3d(e.target.checked)} /> 3D
        </label>
        <label className="row">
          <input type="checkbox" checked={showTracks} onChange={(e) => setShowTracks(e.target.checked)} /> {t(lang, "tracks")}
        </label>
        <label className="row">
          <input type="checkbox" checked={showCivAdsb} onChange={(e) => setShowCivAdsb(e.target.checked)} /> {t(lang, "layerCiv")}
        </label>
        <label className="row">
          <input type="checkbox" checked={showMilAdsb} onChange={(e) => setShowMilAdsb(e.target.checked)} /> {t(lang, "layerMil")}
        </label>
        <label className="row">
          <input type="checkbox" checked={showNeptun} onChange={(e) => setShowNeptun(e.target.checked)} /> {t(lang, "layerNeptun")}
        </label>
        <label className="row">
          <input type="checkbox" checked={showUaAlerts} onChange={(e) => setShowUaAlerts(e.target.checked)} /> {t(lang, "layerUa")}
        </label>
        <label className="field">
          {t(lang, "labels")}
          <select value={labelDensity} onChange={(e) => setLabelDensity(e.target.value as "low" | "dense")}>
            <option value="low">{t(lang, "low")}</option>
            <option value="dense">{t(lang, "dense")}</option>
          </select>
        </label>

        <h3>{t(lang, "language")}</h3>
        <div className="chip-row">
          <button className={`chip ${lang === "pl" ? "on" : ""}`} onClick={() => setLang("pl")}>
            PL
          </button>
          <button className={`chip ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>
            EN
          </button>
        </div>

        <label className="field">
          {t(lang, "backend")}
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlInvalid(false);
            }}
            placeholder="https://"
            aria-invalid={urlInvalid}
          />
        </label>
        <p className="tiny">{t(lang, urlInvalid ? "backendInvalid" : "backendHint")}</p>
        <button className="ghost" onClick={saveBackend}>
          {t(lang, "save")}
        </button>
      </div>
    </section>
  );
}
