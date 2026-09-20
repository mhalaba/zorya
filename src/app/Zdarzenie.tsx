import { useEffect, useState } from "react";
import type { EventItem } from "../model";
import { s } from "../strings";
import { fmtDateTime, fmtTime } from "../format";
import { fetchEvent, sourceChip } from "../api";
import { go } from "../nav";
import { useStore } from "../store";
import { ConfidenceRule, LevelGlyph } from "../components/ui";

export function Zdarzenie({ id }: { id: string }) {
  const horizon = useStore((x) => x.horizon);
  const markAlarmOpened = useStore((x) => x.markAlarmOpened);
  const muteEvent = useStore((x) => x.mutedEvents);
  const setMute = useStore((x) => x.muteEvent);
  const [event, setEvent] = useState<EventItem | null>(horizon?.events.find((e) => e.id === id) ?? null);

  useEffect(() => {
    markAlarmOpened(id);
    let live = true;
    void fetchEvent(id).then((e) => {
      if (live && e) setEvent(e);
    });
    return () => {
      live = false;
    };
  }, [id, markAlarmOpened]);

  if (!event) return <p className="empty">{s("home.loading")}</p>;

  const isAlarm = event.level === "alarm" && event.state === "active";
  const share = () => {
    const url = `${location.origin}/app/zdarzenie/${event.id}`;
    const text = s("event.share_text", {
      level: s(`levels.${event.level}`),
      title: event.title,
      area: event.areas.map((a) => a.name).join(", "),
      time: fmtTime(event.started_at),
      sources: event.sources.map(sourceChip).join(", "),
      confidence: s(`confidence.${event.confidence}`),
      url,
    });
    if (navigator.share) void navigator.share({ text, url, title: s("brand.name") });
    else void navigator.clipboard.writeText(text);
  };

  const stateLine =
    event.state === "cancelled" && event.cancelled_at
      ? s("event.state_cancelled", { time: fmtTime(event.cancelled_at) })
      : event.state === "expired"
        ? s("event.state_expired", { time: fmtTime(event.updated_at) })
        : s("event.state_active", { time: fmtTime(event.updated_at) });

  const muted = (muteEvent[event.id] ?? 0) > Date.now();

  return (
    <main className="detail">
      <div className="top" style={{ display: "flex", alignItems: "center", gap: "var(--z-space-2)" }}>
        <LevelGlyph level={event.level} size="card" />
        <span className={`badge z-label lvl-${event.level}`}>{s(`levels.${event.level}`)}</span>
        <span className="when" style={{ marginLeft: "auto" }}>
          {s("event.id", { id: event.id })}
        </span>
      </div>
      <h1>{event.title}</h1>
      <dl className="kv">
        <dt>{s("event.area")}</dt>
        <dd>{event.areas.map((a) => a.name).join(", ")}</dd>
        <dt>{s("event.since")}</dt>
        <dd className="mono">{fmtDateTime(event.started_at)}</dd>
        <dt>{s("event.state")}</dt>
        <dd>{stateLine}</dd>
        <dt>{s("event.confidence")}</dt>
        <dd>
          <ConfidenceRule confidence={event.confidence} />
        </dd>
      </dl>
      <section className="box">
        <h2>{s("event.what_to_do")}</h2>
        {event.instructions.official ? <p>{event.instructions.official}</p> : null}
        {event.instructions.steps?.length ? (
          <>
            {event.instructions.official ? <p className="note">{s("event.zorya_tips")}</p> : null}
            <ol>
              {event.instructions.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        ) : (
          <p>{s("event.no_tips")}</p>
        )}
      </section>
      <section className="box">
        <h2>{s("event.how_we_know")}</h2>
        <ul className="tl">
          {event.signals.map((sig) => (
            <li key={sig.id}>
              <span className="t">{fmtTime(sig.observed_at)}</span>
              <span>
                {sig.text}
                <br />
                <span className="s">
                  {sig.meta}
                  {sig.counted === false ? ` · ${s("event.not_counted")}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {event.signals.some((sig) => sig.original_text) && (
        <details className="box">
          <summary>{s("event.original")}</summary>
          {event.signals
            .filter((sig) => sig.original_text)
            .map((sig) => (
              <p key={sig.id}>
                {sig.original_text}
                {sig.original_url ? (
                  <>
                    <br />
                    <a href={sig.original_url} rel="noreferrer">
                      {s("event.original_open")}
                    </a>
                  </>
                ) : null}
              </p>
            ))}
        </details>
      )}
      <div className="row" style={{ padding: 0 }}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={share}>
          {s("event.share")}
        </button>
        <button
          type="button"
          className="btn"
          style={{ flex: 1 }}
          disabled={isAlarm || muted}
          onClick={() => setMute(event.id, Date.now() + 60 * 60 * 1000)}
        >
          {s("event.mute_1h")}
        </button>
      </div>
      <p className="note">{isAlarm ? s("event.mute_disabled") : s("event.mute_note")}</p>
      <button type="button" className="linkish" onClick={() => go("/app")}>
        {s("nav.back")}
      </button>
    </main>
  );
}
