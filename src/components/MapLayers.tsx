import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "../store";
import { MAPAUA_URL, NEPTUN_URL, uaDead } from "../mapaua";
import { GNSS_COLORS, GPSJAM_URL, IODA_URL, LOCAL_META, LOCAL_ORDER, NET_COLORS, visibleLocal } from "../overlays";
import type { LocalCategory } from "../types";

/** Always-visible shortcuts: NOTAM list and local alerts list, with live counts. */
export function QuickChips() {
  const air = useStore((s) => s.airspace);
  const local = useStore((s) => s.localAlerts);
  const cats = useStore((s) => s.localCats);
  const panel = useStore((s) => s.listPanel);
  const open = useStore((s) => s.setListPanel);
  const notams = air?.notam.enabled ? air.notam.items : null;
  const zones = notams?.filter((n) => n.map).length ?? 0;
  const loc = visibleLocal(local, cats);
  const active = loc.filter((a) => a.state === "active").length;
  return (
    <div className="map-quick" role="group" aria-label="Przestrzeń powietrzna i alerty lokalne">
      {notams && (
        <button
          type="button"
          className={`mq-chip ${panel === "notam" ? "on" : ""}`}
          aria-pressed={panel === "notam"}
          onClick={() => open(panel === "notam" ? null : "notam")}
          title={air?.notam.ok ? `Przestrzeń FIR EPWW: ${air.notam.source}` : `NOTAM: brak świeżych danych (${air?.notam.error ?? "?"})`}
        >
          <span className="mq-ic notam" aria-hidden="true" />
          NOTAM <b>{notams.length}</b>
          {zones > 0 && <span className="mq-sub">· {zones} stref</span>}
          {!air?.notam.ok && <span className="mq-warn" aria-label="dane nieaktualne">!</span>}
        </button>
      )}
      <button
        type="button"
        className={`mq-chip ${panel === "local" ? "on" : ""}`}
        aria-pressed={panel === "local"}
        onClick={() => open(panel === "local" ? null : "local")}
        title="Awarie i planowane wyłączenia wody, prądu, gazu oraz ćwiczenia (RSO)"
      >
        {LOCAL_ORDER.filter((c) => loc.some((a) => a.categories.includes(c))).map((c) => (
          <span key={c} className="mq-dot" style={{ background: LOCAL_META[c].color }} aria-hidden="true" />
        ))}
        Lokalne <b>{loc.length}</b>
        {active > 0 && <span className="mq-sub">· {active} trwa</span>}
      </button>
    </div>
  );
}

/** Layer menu: airspace (NOTAM + permanent areas), local alerts by category, MAPA.UA. */
export function MapLayers() {
  const snap = useStore((s) => s.uaThreats);
  const air = useStore((s) => s.airspace);
  const local = useStore((s) => s.localAlerts);
  const net = useStore((s) => s.netOutages);
  const gnss = useStore((s) => s.gnss);
  // Only the fields this menu shows: a whole-store subscription would re-render on every map hover.
  const st = useStore(
    useShallow((s) => ({
      notamOn: s.notamOn,
      zonesOn: s.zonesOn,
      localOn: s.localOn,
      netOn: s.netOn,
      gnssOn: s.gnssOn,
      localCats: s.localCats,
      uaMissilesOn: s.uaMissilesOn,
      uaBombsOn: s.uaBombsOn,
      uaDronesOn: s.uaDronesOn,
      setOverlay: s.setOverlay,
      setLocalCat: s.setLocalCat,
      setUaLayer: s.setUaLayer,
      setListPanel: s.setListPanel,
    }))
  );
  const [open, setOpen] = useState(false);
  const objs = snap?.objects ?? [];
  // Counts = objects in flight; grey lost / shot-down markers are drawn but not counted.
  const count = (pred: (k: string) => boolean) => objs.filter((o) => !uaDead(o) && pred(o.kind)).length;
  const nm = count((k) => k.startsWith("missile"));
  const nb = count((k) => k === "bomb");
  const nd = count((k) => k.startsWith("drone"));
  const uaOn = !!snap?.enabled && (st.uaMissilesOn || st.uaBombsOn || st.uaDronesOn);
  const notamZones = air?.notam.items.filter((n) => n.map).length ?? 0;
  const allLocal = (local?.items ?? []).filter((a) => a.state !== "ended");
  const nLocal = (c: LocalCategory) => allLocal.filter((a) => a.categories.includes(c)).length;

  return (
    <>
      <div className="ua-layers">
        <button type="button" className="ua-layers-btn" aria-expanded={open} onClick={() => setOpen((x) => !x)} title="Warstwy mapy">
          Warstwy{nm ? ` · ${nm} rak.` : ""}
        </button>
        {open && (
          <div className="ua-layers-pop" role="group" aria-label="Warstwy mapy">
            <div className="ly-h">Przestrzeń powietrzna</div>
            {air?.notam.enabled !== false && (
              <label>
                <input type="checkbox" checked={st.notamOn} onChange={(e) => st.setOverlay("notamOn", e.target.checked)} />
                <span className="ua-sw notam" /> Strefy z NOTAM / AUP <span className="muted">{notamZones}</span>
              </label>
            )}
            {air?.zones.enabled && (
              <label>
                <input type="checkbox" checked={st.zonesOn} onChange={(e) => st.setOverlay("zonesOn", e.target.checked)} />
                <span className="ua-sw zone" /> Strefy stałe P/R/D/TSA/TRA <span className="muted">{air.zones.items.length}</span>
              </label>
            )}
            <button type="button" className="ly-link" onClick={() => (setOpen(false), st.setListPanel("notam"))}>
              Lista NOTAM / AUP ({air?.notam.items.length ?? 0}) →
            </button>

            <div className="ly-h">Lokalne: awarie, wyłączenia, ćwiczenia, IMGW</div>
            <label>
              <input type="checkbox" checked={st.localOn} onChange={(e) => st.setOverlay("localOn", e.target.checked)} />
              Pokaż na mapie <span className="muted">{allLocal.length}</span>
            </label>
            <div className="ly-cats">
              {LOCAL_ORDER.map((c) => (
                <label key={c} className="ly-cat">
                  <input type="checkbox" checked={st.localCats[c]} onChange={(e) => st.setLocalCat(c, e.target.checked)} />
                  <span className="ua-sw" style={{ background: LOCAL_META[c].color }} /> {LOCAL_META[c].short}{" "}
                  <span className="muted">{nLocal(c)}</span>
                </label>
              ))}
            </div>
            <button type="button" className="ly-link" onClick={() => (setOpen(false), st.setListPanel("local"))}>
              Lista alertów lokalnych →
            </button>

            {(net?.enabled !== false || gnss?.enabled !== false) && <div className="ly-h">Internet i GPS (PL, Bałtyk, Białoruś, Ukraina)</div>}
            {net?.enabled !== false && (
              <label title="IODA (Georgia Tech): spadki tras BGP, aktywnego sondowania i ruchu w ostatnich 24 h">
                <input type="checkbox" checked={st.netOn} onChange={(e) => st.setOverlay("netOn", e.target.checked)} />
                <span className="ua-sw" style={{ background: NET_COLORS[3] }} /> Awarie internetu{" "}
                <span className="muted">{net?.items.filter((i) => i.active).length ?? 0} trwa / {net?.items.length ?? 0}</span>
              </label>
            )}
            {gnss?.enabled !== false && (
              <label title={gnss?.method}>
                <input type="checkbox" checked={st.gnssOn} onChange={(e) => st.setOverlay("gnssOn", e.target.checked)} />
                <span className="ua-sw" style={{ background: GNSS_COLORS.high }} /> Zakłócenia GPS{" "}
                <span className="muted">{gnss?.daily.cells ?? 0} dob. · {gnss?.live.hot_cells ?? 0} na żywo</span>
              </label>
            )}
            {(st.netOn || st.gnssOn) && (
              <div className="tiny ly-legend">
                {st.netOn && (
                  <div>
                    Internet: <span className="mq-dot" style={{ background: NET_COLORS[1] }} /> drobne{" "}
                    <span className="mq-dot" style={{ background: NET_COLORS[2] }} /> wyraźne{" "}
                    <span className="mq-dot" style={{ background: NET_COLORS[3] }} /> poważne, pierścień = trwa
                  </div>
                )}
                {st.gnssOn && (
                  <div>
                    GPS: <span className="mq-dot" style={{ background: GNSS_COLORS.low }} /> 2–10%{" "}
                    <span className="mq-dot" style={{ background: GNSS_COLORS.high }} /> &gt;10% samolotów (wczoraj){" "}
                    <span className="mq-dot" style={{ background: GNSS_COLORS.live }} /> na żywo (45 min)
                  </div>
                )}
              </div>
            )}
            {snap?.enabled !== false && (
              <>
                <div className="ly-h">Nad Ukrainą (własny silnik Zorya)</div>
                <label>
                  <input type="checkbox" checked={st.uaMissilesOn} onChange={(e) => st.setUaLayer("uaMissilesOn", e.target.checked)} />
                  <span className="ua-sw cruise" /> Rakiety <span className="muted">{nm}</span>
                </label>
                <label>
                  <input type="checkbox" checked={st.uaBombsOn} onChange={(e) => st.setUaLayer("uaBombsOn", e.target.checked)} />
                  <span className="ua-sw bomb" /> Bomby KAB <span className="muted">{nb}</span>
                </label>
                <label>
                  <input type="checkbox" checked={st.uaDronesOn} onChange={(e) => st.setUaLayer("uaDronesOn", e.target.checked)} />
                  <span className="ua-sw drone" /> Drony <span className="muted">{nd}</span>
                </label>
              </>
            )}
            <div className="tiny">
              {air && !air.notam.ok && air.notam.enabled ? `NOTAM: brak świeżych danych (${air.notam.error}). ` : ""}
              {snap?.ok === false ? `Ukraina: brak świeżych danych${snap.error ? ` (${snap.error})` : ""}. ` : ""}
              {snap?.sources ? `Ukraina: własne ${snap.sources.own}, uzupełnienie MAPA.UA ${snap.sources["mapa.ua"]}${snap.sources.neptun ? `, NEPTUN ${snap.sources.neptun}` : ""}. ` : ""}
              {net && net.enabled && !net.ok ? `IODA: brak świeżych danych (${net.error}). ` : ""}
              {gnss && gnss.enabled && !gnss.daily.ok ? `gpsjam: brak danych (${gnss.daily.error}). ` : ""}
              Warstwy informacyjne — nie zmieniają poziomu zagrożenia województw.
            </div>
          </div>
        )}
      </div>
      {((st.netOn && net?.enabled) || (st.gnssOn && gnss?.enabled)) && (
        <div className="ua-attr net-attr">
          {st.netOn && net?.enabled && (
            <>
              Internet:{" "}
              <a href={IODA_URL} target="_blank" rel="noopener noreferrer">IODA, Georgia Tech</a>
              {net.cloudflare.enabled ? " · Cloudflare Radar (CC BY-NC 4.0)" : ""}.{" "}
            </>
          )}
          {st.gnssOn && gnss?.enabled && (
            <>
              GPS:{" "}
              <a href={GPSJAM_URL} target="_blank" rel="noopener noreferrer">gpsjam.org</a> (ADS-B Exchange) ·{" "}
              <a href="https://adsb.lol" target="_blank" rel="noopener noreferrer">adsb.lol</a> (ODbL) ·{" "}
              <a href="https://adsb.fi" target="_blank" rel="noopener noreferrer">adsb.fi</a>
            </>
          )}
        </div>
      )}
      {uaOn && (
        <div className="ua-attr">
          Źródło: własny silnik Zorya (kanały Telegram z rejestru{" "}
          <a href={NEPTUN_URL} target="_blank" rel="noopener noreferrer">
            NEPTUN
          </a>
          ) · uzupełnienie:{" "}
          <a href={MAPAUA_URL} target="_blank" rel="noopener noreferrer">
            MAPA.UA
          </a>
          <span className="ua-note">Szacunkowe pozycje z komunikatów, to nie jest oficjalne ostrzeżenie.</span>
        </div>
      )}
    </>
  );
}
