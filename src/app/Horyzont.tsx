import { useState, type ReactNode } from "react";
import type { AreaRole, Signal } from "../model";
import { s, statusEventsLine } from "../strings";
import { fmtTime } from "../format";
import { searchAreas, signalKindGroup } from "../api";
import { go } from "../nav";
import { useStore } from "../store";
import { EventCard, SignalRow, StatusBlock } from "../components/Feed";
import { Eyebrow, HorizonRule, SheetFrame, Toggle } from "../components/ui";

function Mono({ children }: { children: string }) {
  return <span className="mono">{children}</span>;
}

function statusMeta(h: ReturnType<typeof useStore.getState>["horizon"]): ReactNode {
  if (!h) return s("home.loading");
  const st = h.status;
  if (st.level === "cisza" && st.active_events === 0) {
    return s("home.empty", { time: fmtTime(st.data_as_of) });
  }
  return (
    <>
      {st.level === "alarm" ? (
        <>
          {s("home.status_alarm_meta", { time: "" })}
          <Mono>{fmtTime(st.since)}</Mono>
        </>
      ) : (
        <>
          {statusEventsLine(st.active_events, "")}
          <Mono>{fmtTime(st.since)}</Mono>
        </>
      )}
      <br />
      {s("home.status_sources", { active: st.sources_active, total: st.sources_total, time: "" })}
      <Mono>{fmtTime(st.data_as_of)}</Mono>
      {st.stale ? (
        <>
          <br />
          <span className="status-stale">{s("home.status_stale", { time: fmtTime(st.data_as_of) })}</span>
        </>
      ) : null}
    </>
  );
}

export function Horyzont() {
  const horizon = useStore((x) => x.horizon);
  const loading = useStore((x) => x.loading);
  const setSheet = useStore((x) => x.setSheet);
  const signalFilter = useStore((x) => x.signalFilter);
  const reports = useStore((x) => x.reports);
  const notifyGranted = useStore((x) => x.notifyGranted);
  const onboardingDone = useStore((x) => x.onboardingDone);
  const alarmOpened = useStore((x) => x.alarmOpened);
  const sourceOn = useStore((x) => x.sourceOn);
  const areas = useStore((x) => x.areas);

  if (!onboardingDone && areas.length === 0) {
    return <p className="empty">{s("home.no_areas")}</p>;
  }
  if (loading && !horizon) {
    return (
      <>
        <section className="status" aria-live="polite">
          <span className="lg lg-hero" />
          <div>
            <div className="word">{s("home.loading")}</div>
          </div>
        </section>
        <HorizonRule />
      </>
    );
  }
  if (!horizon) return <p className="empty">{s("home.loading")}</p>;

  const events = [...horizon.events].sort((a, b) => {
    const rank: Record<string, number> = { alarm: 4, ostrzezenie: 3, obserwacja: 2, odwolanie: 1, cisza: 0 };
    const d = (rank[b.level] ?? 0) - (rank[a.level] ?? 0);
    if (d) return d;
    return b.started_at.localeCompare(a.started_at);
  });
  const alarm = events.find((e) => e.level === "alarm" && e.state === "active");
  const below: Signal[] = horizon.signals.filter((sig) => {
    if (sourceOn.zgloszenia === false && sig.source === "zgloszenia") return false;
    const g = signalKindGroup(sig.source);
    return signalFilter[g] !== false;
  });
  const myReports: Signal[] = reports
    .filter((r) => r.state === "sent" || r.state === "queued")
    .map((r) => ({
      id: r.id,
      source: "zgloszenia" as const,
      kind: "other" as const,
      observed_at: r.observed_at,
      received_at: r.observed_at,
      areas: r.area ? [r.area] : [],
      text: r.note ? `${s(`report.kinds.${r.kind}`)}: „${r.note}”` : s(`report.kinds.${r.kind}`),
      meta: `${s("sources.zgloszenia.short")} · ${r.place_label ?? ""} · ${s("confidence.niezweryfikowane")}`,
    }));
  const allBelow = [...myReports, ...below].sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  const breathe = Boolean(alarm && !alarmOpened[alarm.id]);
  const empty = events.length === 0 && allBelow.length === 0;

  return (
    <>
      {!notifyGranted && onboardingDone && (
        <p className="notify-off">
          {s("home.notifications_off")}{" "}
          <button type="button" className="linkish" onClick={() => go("/app/wiecej")}>
            {s("home.notifications_settings")}
          </button>
        </p>
      )}
      <StatusBlock
        level={horizon.status.level}
        title={s(`levels.${horizon.status.level}_cap`)}
        meta={statusMeta(horizon)}
        assertive={horizon.status.level === "alarm"}
        breathe={breathe}
      />
      <Eyebrow
        label={s("home.events")}
        action={
          <button type="button" className="linkish" onClick={() => setSheet({ kind: "areas" })}>
            {s("header.all_areas")}
          </button>
        }
      />
      {empty && <p className="empty">{s("home.empty", { time: fmtTime(horizon.status.data_as_of) })}</p>}
      {events.map((e) => (
        <div key={e.id}>
          <EventCard event={e} />
          {e.level === "alarm" && e.state === "active" && (
            <div className="row" style={{ marginBottom: "var(--z-space-3)" }}>
              <a
                className="btn primary block"
                href={`/app/zdarzenie/${e.id}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  go(`/app/zdarzenie/${e.id}`);
                }}
              >
                {s("home.what_to_do_now")}
              </a>
            </div>
          )}
        </div>
      ))}
      <HorizonRule />
      <Eyebrow
        label={s("home.signals")}
        action={
          <button type="button" className="linkish" onClick={() => setSheet({ kind: "filter" })}>
            {s("home.filter")}
          </button>
        }
      />
      {allBelow.map((sig) => (
        <SignalRow key={sig.id} signal={sig} onOpen={() => go(`/app/sygnaly/${sig.source}`)} />
      ))}
    </>
  );
}

export function FilterSheet() {
  const sheet = useStore((x) => x.sheet);
  const setSheet = useStore((x) => x.setSheet);
  const signalFilter = useStore((x) => x.signalFilter);
  const setSignalFilter = useStore((x) => x.setSignalFilter);
  if (sheet?.kind !== "filter") return null;
  const keys = ["official", "sensor", "radio", "reports"] as const;
  return (
    <SheetFrame title={s("filter.title")} onClose={() => setSheet(null)}>
      <div className="list">
        {keys.map((k) => (
          <div className="li" key={k}>
            <span className="t">{s(`filter.${k}`)}</span>
            <Toggle on={signalFilter[k] !== false} onChange={(v) => setSignalFilter(k, v)} label={s(`filter.${k}`)} />
          </div>
        ))}
      </div>
    </SheetFrame>
  );
}

export function AreaSheet() {
  const sheet = useStore((x) => x.sheet);
  const setSheet = useStore((x) => x.setSheet);
  const areas = useStore((x) => x.areas);
  const selected = useStore((x) => x.selectedAreaId);
  const setSelectedAreaId = useStore((x) => x.setSelectedAreaId);
  const addArea = useStore((x) => x.addArea);
  const [q, setQ] = useState("");
  if (sheet?.kind !== "areas" && sheet?.kind !== "add-area") return null;
  if (sheet.kind === "add-area") {
    return (
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
    );
  }
  return (
    <SheetFrame title={s("settings.areas")} onClose={() => setSheet(null)}>
      <div className="list">
        {areas.map((a) => (
          <button type="button" className="li" key={a.area.id} onClick={() => setSelectedAreaId(a.area.id)}>
            <span className="t">{a.area.name}</span>
            <span className="d">
              {a.area.kind} · {s(`settings.role_${a.role}`)}
            </span>
            <span className="r">{selected === a.area.id ? s("settings.primary") : ""}</span>
          </button>
        ))}
        <button type="button" className="li" onClick={() => setSelectedAreaId(null)}>
          <span className="t">{s("header.all_areas")}</span>
        </button>
        <button type="button" className="li" onClick={() => setSheet({ kind: "add-area" })}>
          <span className="t">{s("settings.add")}</span>
        </button>
      </div>
    </SheetFrame>
  );
}
