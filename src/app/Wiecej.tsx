import { useState } from "react";
import { s } from "../strings";
import { searchAreas } from "../api";
import { useStore } from "../store";
import { SheetFrame, Toggle } from "../components/ui";
import type { AreaRole, ThemePref } from "../model";

export function Wiecej() {
  const areas = useStore((x) => x.areas);
  const setSheet = useStore((x) => x.setSheet);
  const sheet = useStore((x) => x.sheet);
  const notifyOstrzezenie = useStore((x) => x.notifyOstrzezenie);
  const notifyObserwacja = useStore((x) => x.notifyObserwacja);
  const notifyOdwolanie = useStore((x) => x.notifyOdwolanie);
  const setNotify = useStore((x) => x.setNotify);
  const quiet = useStore((x) => x.quiet);
  const setQuiet = useStore((x) => x.setQuiet);
  const sourceOn = useStore((x) => x.sourceOn);
  const setSourceOn = useStore((x) => x.setSourceOn);
  const theme = useStore((x) => x.theme);
  const setTheme = useStore((x) => x.setTheme);
  const reduceMotion = useStore((x) => x.reduceMotion);
  const setReduceMotion = useStore((x) => x.setReduceMotion);
  const addArea = useStore((x) => x.addArea);
  const [q, setQ] = useState("");

  return (
    <>
      <h1 className="screen">{s("settings.title")}</h1>
      <div className="eyebrow">
        <span className="z-label">{s("settings.areas")}</span>
        <button type="button" className="linkish" onClick={() => setSheet({ kind: "add-area" })}>
          {s("settings.add")}
        </button>
      </div>
      <div className="list">
        {areas.map((a) => (
          <div className="li" key={a.area.id}>
            <span className="t">{a.area.name.replace(/^gmina\s+/i, "")}</span>
            <span className="d">
              {a.area.kind} · {s(`settings.role_${a.role}`)}
            </span>
            <span className="r">{a.primary ? s("settings.primary") : ""}</span>
          </div>
        ))}
      </div>
      <div className="eyebrow">
        <span className="z-label">{s("settings.notifications")}</span>
      </div>
      <div className="list">
        <div className="li">
          <span className="t">{s("settings.n_alarm")}</span>
          <span className="d">{s("settings.n_alarm_desc")}</span>
          <Toggle on locked label={s("settings.n_alarm")} />
        </div>
        <div className="li">
          <span className="t">{s("settings.n_ostrzezenie")}</span>
          <span className="d">{s("settings.n_ostrzezenie_desc")}</span>
          <Toggle on={notifyOstrzezenie} onChange={(v) => setNotify("ostrzezenie", v)} label={s("settings.n_ostrzezenie")} />
        </div>
        <div className="li">
          <span className="t">{s("settings.n_obserwacja")}</span>
          <span className="d">{s("settings.n_obserwacja_desc")}</span>
          <Toggle on={notifyObserwacja} onChange={(v) => setNotify("obserwacja", v)} label={s("settings.n_obserwacja")} />
        </div>
        <div className="li">
          <span className="t">{s("settings.n_odwolanie")}</span>
          <span className="d">{s("settings.n_odwolanie_desc")}</span>
          <Toggle on={notifyOdwolanie} onChange={(v) => setNotify("odwolanie", v)} label={s("settings.n_odwolanie")} />
        </div>
        <button type="button" className="li" onClick={() => setSheet({ kind: "quiet" })}>
          <span className="t">{s("settings.quiet")}</span>
          <span className="d">{s("settings.quiet_desc")}</span>
          <span className="r">
            {quiet.from}–{quiet.to}
          </span>
        </button>
      </div>
      <p className="note pad">{s("settings.alarm_locked")}</p>
      <div className="eyebrow">
        <span className="z-label">{s("settings.sources")}</span>
      </div>
      <div className="list">
        <div className="li">
          <span className="t">{s("settings.s_reports")}</span>
          <span className="d">{s("settings.s_reports_desc")}</span>
          <Toggle on={sourceOn.zgloszenia !== false} onChange={(v) => setSourceOn("zgloszenia", v)} label={s("settings.s_reports")} />
        </div>
        <div className="li">
          <span className="t">{s("settings.s_radio")}</span>
          <span className="d">{s("settings.s_radio_desc")}</span>
          <Toggle on={sourceOn.radio_ews === true} onChange={(v) => setSourceOn("radio_ews", v)} label={s("settings.s_radio")} />
        </div>
      </div>
      <div className="eyebrow">
        <span className="z-label">{s("settings.a11y")}</span>
      </div>
      <div className="list">
        <button type="button" className="li" onClick={() => setSheet({ kind: "theme" })}>
          <span className="t">{s("settings.theme")}</span>
          <span className="d">{s("settings.theme_desc")}</span>
          <span className="r">{s(`settings.theme_${theme}`)}</span>
        </button>
        <div className="li">
          <span className="t">{s("settings.text_size")}</span>
          <span className="d">{s("settings.text_size_desc")}</span>
          <span className="r">100 %</span>
        </div>
        <div className="li">
          <span className="t">{s("settings.reduce_motion")}</span>
          <span className="d">{s("settings.reduce_motion_desc")}</span>
          <Toggle on={reduceMotion} onChange={setReduceMotion} label={s("settings.reduce_motion")} />
        </div>
      </div>
      <div className="eyebrow">
        <span className="z-label">{s("settings.about")}</span>
      </div>
      <div className="list">
        <a className="li" href="/jak-dziala">
          <span className="t">{s("web.menu_how")}</span>
        </a>
        <a className="li" href="/prywatnosc">
          <span className="t">{s("web.menu_privacy")}</span>
        </a>
        <a className="li" href="/status">
          <span className="t">{s("web.menu_status")}</span>
        </a>
        <a className="li" href="https://github.com/mhalaba/zorya">
          <span className="t">{s("settings.source_code")}</span>
        </a>
        <a className="li" href="/kontakt">
          <span className="t">{s("settings.contact")}</span>
        </a>
        <div className="li">
          <span className="t">{s("settings.licences")}</span>
          <span className="d">{s("pages.licences_fonts")}</span>
        </div>
        <div className="li">
          <span className="t">{s("settings.version", { v: "0.1" })}</span>
          <span className="d">{s("pages.foundation_line")}</span>
        </div>
      </div>

      {sheet?.kind === "theme" && (
        <SheetFrame title={s("settings.theme")} onClose={() => setSheet(null)}>
          <div className="list">
            {(["noc", "dzien", "system"] as ThemePref[]).map((t) => (
              <button
                type="button"
                className="li"
                key={t}
                onClick={() => {
                  setTheme(t);
                  setSheet(null);
                }}
              >
                <span className="t">{s(`settings.theme_${t}`)}</span>
                <span className="r">{theme === t ? "●" : ""}</span>
              </button>
            ))}
          </div>
        </SheetFrame>
      )}
      {sheet?.kind === "quiet" && (
        <SheetFrame title={s("settings.quiet")} onClose={() => setSheet(null)}>
          <div className="form" style={{ padding: 0 }}>
            <div className="field">
              <label>od</label>
              <input type="time" value={quiet.from} onChange={(e) => setQuiet({ ...quiet, from: e.target.value })} />
            </div>
            <div className="field">
              <label>do</label>
              <input type="time" value={quiet.to} onChange={(e) => setQuiet({ ...quiet, to: e.target.value })} />
            </div>
            <p className="note">{s("settings.quiet_desc")}</p>
          </div>
        </SheetFrame>
      )}
      {sheet?.kind === "add-area" && (
        <SheetFrame title={s("settings.add")} onClose={() => setSheet(null)}>
          <div className="field">
            <label>{s("settings.area_search")}</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="list">
            {searchAreas(q).map((a) => (
              <button
                type="button"
                className="li"
                key={a.id}
                onClick={() => {
                  const role: AreaRole = "dom";
                  addArea({ area: a, role, primary: areas.length === 0 });
                  setSheet(null);
                }}
              >
                <span className="t">{a.name}</span>
                <span className="d">{a.kind}</span>
              </button>
            ))}
          </div>
        </SheetFrame>
      )}
    </>
  );
}