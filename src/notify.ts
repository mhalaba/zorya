import type { HorizonPayload, Level } from "./model";
import { s } from "./strings";
import { fmtTime, inQuietHours } from "./format";
import { sourceChip } from "./api";
import { useStore } from "./store";
import { playAlarm, playOdwolanie, playOstrzezenie } from "./audio";

const seen = new Set<string>();

function titleFor(level: Level, area: string) {
  if (level === "alarm") return s("push.alarm_title", { area });
  if (level === "ostrzezenie") return s("push.ostrzezenie_title", { area });
  if (level === "obserwacja") return s("push.obserwacja_title", { area });
  if (level === "odwolanie") return s("push.odwolanie_title", { area });
  return s("brand.name");
}

export function maybeNotify(h: HorizonPayload) {
  const st = useStore.getState();
  if (!st.notifyGranted) return;
  const quiet = inQuietHours(st.quiet.from, st.quiet.to);
  for (const ev of h.events) {
    if (st.mutedEvents[ev.id] && st.mutedEvents[ev.id] > Date.now()) continue;
    const key = `${ev.id}:${ev.level}:${ev.updated_at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const area = ev.areas[0]?.name ?? h.status.area.name;
    const what = ev.title;
    const sources = ev.sources.map(sourceChip).join(", ");
    let body = "";
    if (ev.level === "alarm") {
      body = s("push.alarm_body", {
        what,
        instruction: ev.instructions.steps[0] ?? ev.instructions.official,
        time: fmtTime(ev.started_at),
        sources,
      });
    } else if (ev.level === "ostrzezenie") {
      body = s("push.ostrzezenie_body", { what, validity: ev.valid_until ?? "", sources });
    } else if (ev.level === "obserwacja") {
      if (!st.notifyObserwacja) continue;
      body = s("push.obserwacja_body", { what });
    } else if (ev.level === "odwolanie") {
      if (!st.notifyOdwolanie) continue;
      body = s("push.odwolanie_body", { what, time: fmtTime(ev.cancelled_at ?? ev.updated_at) });
    } else continue;

    const sound = ev.level === "alarm" || (ev.level === "ostrzezenie" && st.notifyOstrzezenie && !quiet) || ev.level === "odwolanie";
    if (ev.level === "alarm") playAlarm();
    else if (ev.level === "ostrzezenie" && !quiet) playOstrzezenie();
    else if (ev.level === "odwolanie") playOdwolanie();

    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(titleFor(ev.level, area), {
        body,
        tag: `event-${ev.id}`,
        silent: !sound,
      });
      n.onclick = () => {
        window.focus();
        location.assign(`/app/zdarzenie/${ev.id}${location.search}`);
      };
    }
  }
}
