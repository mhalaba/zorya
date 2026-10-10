import { useEffect, useState } from "react";
import { useStore } from "../store";
import { MAPAUA_URL } from "../mapaua";
import type { UaThreatsSnapshot } from "../types";

const POLL_MS = 30_000;

/** Pull /api/ua-threats every 30 s while the tab is visible (the server itself polls MAPA.UA at most every 30 s). */
export function useUaThreats() {
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          const base = (useStore.getState().backendUrl || "").replace(/\/$/, "");
          const r = await fetch(`${base}/api/ua-threats`);
          if (r.ok) useStore.getState().setUaThreats((await r.json()) as UaThreatsSnapshot);
        } catch {
          /* keep the last snapshot */
        }
      }
      if (!stop) t = setTimeout(tick, POLL_MS);
    };
    void tick();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(t);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}

/** Small layer switch for the MAPA.UA layers + mandatory attribution. */
export function UaLayers() {
  const snap = useStore((s) => s.uaThreats);
  const m = useStore((s) => s.uaMissilesOn);
  const b = useStore((s) => s.uaBombsOn);
  const d = useStore((s) => s.uaDronesOn);
  const set = useStore((s) => s.setUaLayer);
  const [open, setOpen] = useState(false);
  if (snap && !snap.enabled) return null;
  const objs = snap?.objects ?? [];
  const count = (pred: (k: string) => boolean) => objs.filter((o) => pred(o.kind)).length;
  const nm = count((k) => k.startsWith("missile"));
  const nb = count((k) => k === "bomb");
  const nd = count((k) => k.startsWith("drone"));
  const anyOn = m || b || d;

  return (
    <>
      <div className="ua-layers">
        <button
          type="button"
          className="ua-layers-btn"
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
          title="Warstwy MAPA.UA"
        >
          Warstwy{nm ? ` · ${nm} rak.` : ""}
        </button>
        {open && (
          <div className="ua-layers-pop" role="group" aria-label="Warstwy MAPA.UA">
            <label>
              <input type="checkbox" checked={m} onChange={(e) => set("uaMissilesOn", e.target.checked)} />
              <span className="ua-sw cruise" /> Rakiety (UA) <span className="muted">{nm}</span>
            </label>
            <label>
              <input type="checkbox" checked={b} onChange={(e) => set("uaBombsOn", e.target.checked)} />
              <span className="ua-sw bomb" /> Bomby KAB (UA) <span className="muted">{nb}</span>
            </label>
            <label>
              <input type="checkbox" checked={d} onChange={(e) => set("uaDronesOn", e.target.checked)} />
              <span className="ua-sw drone" /> Drony (MAPA.UA) <span className="muted">{nd}</span>
            </label>
            <div className="tiny">
              {snap?.ok === false && snap.error ? `MAPA.UA: brak świeżych danych (${snap.error}). ` : ""}
              Szare = zestrzelone, utracone lub po trafieniu.
            </div>
          </div>
        )}
      </div>
      {anyOn && (
        <div className="ua-attr">
          Dane o rakietach:{" "}
          <a href={MAPAUA_URL} target="_blank" rel="noopener noreferrer">
            MAPA.UA
          </a>
          <span className="ua-note">Szacunkowe pozycje z komunikatów, to nie jest oficjalne ostrzeżenie.</span>
        </div>
      )}
    </>
  );
}
