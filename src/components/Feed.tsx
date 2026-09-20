import type { ReactNode } from "react";
import type { EventItem, Level, Signal } from "../model";
import { s } from "../strings";
import { fmtTime, validityLine } from "../format";
import { go } from "../nav";
import { ConfidenceRule, LevelGlyph, SourceChips } from "./ui";

export function EventCard({
  event,
  onOpen,
}: {
  event: EventItem;
  onOpen?: () => void;
}) {
  const where = event.areas.map((a) => a.name).join(", ");
  const until = event.state === "cancelled" && event.cancelled_at
    ? s("event.cancelled_suffix", { time: fmtTime(event.cancelled_at) })
    : validityLine(event.valid_until);
  return (
    <a
      className={`card lvl-${event.level}`}
      href={`/app/zdarzenie/${event.id}`}
      onClick={(e) => {
        e.preventDefault();
        onOpen?.();
        go(`/app/zdarzenie/${event.id}`);
      }}
    >
      <div className="top">
        <LevelGlyph level={event.level} size="card" />
        <span className="badge">{s(`levels.${event.level}`)}</span>
        <span className="when">{fmtTime(event.started_at)}</span>
      </div>
      <h3>
        {event.title}
        {event.state === "cancelled" && event.cancelled_at
          ? ` ${s("event.cancelled_suffix", { time: fmtTime(event.cancelled_at) })}`
          : ""}
      </h3>
      <div className="where">
        {where} · {until}
      </div>
      <SourceChips ids={event.sources} alarm={event.level === "alarm"} />
      <ConfidenceRule confidence={event.confidence} extra={event.confidence_reason} />
    </a>
  );
}

export function StatusBlock({
  level,
  title,
  meta,
  assertive,
  breathe,
}: {
  level: Level;
  title: string;
  meta: ReactNode;
  assertive?: boolean;
  breathe?: boolean;
}) {
  return (
    <section className="status" aria-live={assertive ? "assertive" : "polite"} aria-label={s("levels.a11y_prefix", { level: s(`levels.${level}`) })}>
      <LevelGlyph level={level} size="hero" breathe={breathe} />
      <div>
        <div className={`word lvl-${level}`}>{title}</div>
        <div className="meta">{meta}</div>
      </div>
    </section>
  );
}

export function SignalRow({
  signal,
  onOpen,
}: {
  signal: Signal;
  onOpen?: () => void;
}) {
  const dotted = signal.source === "zgloszenia";
  return (
    <button
      type="button"
      className={`sig${dotted || signal.source === "zgloszenia" ? " dotted" : ""}`}
      onClick={onOpen}
    >
      <span className="t">{signal.text}</span>
      <span className="m">{fmtTime(signal.observed_at)}</span>
      <span className="k">{signal.meta}</span>
    </button>
  );
}
