import { useEffect, useState } from "react";
import type { ReportKind } from "../model";
import { s } from "../strings";
import { fmtDateTime, plusMinutes, roundTo500m } from "../format";
import { deleteReport, postReport } from "../api";
import { useStore } from "../store";

const KINDS: ReportKind[] = ["syrena", "huk", "dron_samolot", "dym_pozar", "brak_pradu", "inne"];

export function Zglos() {
  const areas = useStore((x) => x.areas);
  const selected = useStore((x) => x.selectedAreaId);
  const addReport = useStore((x) => x.addReport);
  const withdrawReport = useStore((x) => x.withdrawReport);
  const reports = useStore((x) => x.reports);
  const offline = useStore((x) => x.offline);
  const area = areas.find((a) => a.area.id === selected) ?? areas[0];

  const [kind, setKind] = useState<ReportKind>("syrena");
  const [note, setNote] = useState("");
  const [when] = useState(() => new Date().toISOString());
  const [where, setWhere] = useState(() =>
    area?.area.name ? `${area.area.name.replace(/^gmina\s+/i, "")} — ${s("onboarding.from_device")}` : ""
  );
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const last = reports[0];

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const r = roundTo500m(pos.coords.latitude, pos.coords.longitude);
        setWhere(`${area?.area.name ?? ""} — ${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}`);
      },
      () => undefined,
      { maximumAge: 60_000, timeout: 4000 }
    );
  }, [area?.area.name]);

  async function send() {
    setError("");
    if (!kind) {
      setError(s("report.what"));
      return;
    }
    const loc = roundTo500m(50.3, 18.65);
    try {
      const res = await postReport({
        kind,
        observed_at: when,
        location: { ...loc, rounded_m: 500 },
        note: note.slice(0, 200),
        area_id: area?.area.id,
      });
      addReport({
        id: res.id,
        kind,
        observed_at: when,
        location: { ...loc, rounded_m: 500 },
        area: area?.area,
        note: note.slice(0, 200),
        state: offline ? "queued" : "sent",
        withdraw_until: res.withdraw_until,
        place_label: area?.area.name,
      });
    } catch {
      addReport({
        id: `r-${Date.now()}`,
        kind,
        observed_at: when,
        location: { lat: 50.3, lon: 18.65, rounded_m: 500 },
        area: area?.area,
        note,
        state: "queued",
        withdraw_until: plusMinutes(when, 10),
        place_label: area?.area.name,
      });
    }
  }

  const until = last?.withdraw_until ? fmtDateTime(last.withdraw_until) : "";

  return (
    <>
      <h1 className="screen">{s("report.title")}</h1>
      <p className="note pad">{s("report.intro")}</p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="field">
          <label>{s("report.what")}</label>
          <div className="seg">
            {KINDS.slice(0, 3).map((k) => (
              <button type="button" key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
                {s(`report.kinds.${k}`)}
              </button>
            ))}
          </div>
          <div className="seg" style={{ marginTop: -1 }}>
            {KINDS.slice(3).map((k) => (
              <button type="button" key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
                {s(`report.kinds.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>{s("report.where")}</label>
          <input
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            aria-label={s("report.where")}
          />
        </div>
        <div className="field">
          <label>{s("report.when")}</label>
          <div className="in mono">{s("report.when_now", { datetime: fmtDateTime(when) })}</div>
        </div>
        <div className="field">
          <label>{s("report.note")}</label>
          <textarea
            rows={1}
            maxLength={200}
            placeholder={s("report.note_placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{s("report.media")}</label>
          <label className="in ph file-ph">
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
            {fileName || s("report.media_placeholder")}
          </label>
        </div>
        {error ? <p className="err field">{error}</p> : null}
        <p className="note">{s("report.privacy")}</p>
        <button type="submit" className="btn primary block">
          {s("report.send")}
        </button>
        {last && last.state !== "withdrawn" && (
          <p className="note">
            {last.state === "queued"
              ? s("report.queued")
              : s("report.sent", { time: fmtDateTime(last.observed_at), until })}
            {last.withdraw_until && new Date(last.withdraw_until) > new Date() && last.state === "sent" && (
              <>
                {" "}
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    withdrawReport(last.id);
                    void deleteReport(last.id);
                  }}
                >
                  {s("report.withdraw")}
                </button>
              </>
            )}
          </p>
        )}
        {last?.state === "withdrawn" && <p className="note">{s("report.withdrawn")}</p>}
      </form>
    </>
  );
}
