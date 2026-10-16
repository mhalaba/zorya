import { useEffect, useRef, useState } from "react";

// Time from the Starlink dish's NTP server (via /api/starlink-time).
// Between syncs it ticks with performance.now(); it never shows the browser's own clock.
const RESYNC_MS = 60_000;
const STALE_MS = 3 * 60_000;
export const TZ = "Europe/Warsaw";
export const LABEL = "Czas Starlink (serwer czasu Starlinka, GPS) · Europe/Warsaw";
export const NO_SYNC = "brak synchronizacji ze Starlinkiem";
export const TITLE =
  "Czas z serwera czasu NTP anteny Starlink (GPS, 192.168.100.1), odczytywany przez serwer Zoryi. To nie jest zegar Twojego urządzenia.";

export const fmtWarsaw = (ms: number) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(
    new Date(ms)
  );

type Sync = { base: number; mono: number; syncedAt: number };

/** Current Starlink time in ms (or null when not synced) and the time of the last sync. */
export function useStarlinkTime(): { now: number | null; syncedAt: number | null } {
  const sync = useRef<Sync | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const t0 = performance.now();
      try {
        const r = await fetch("/api/starlink-time", { cache: "no-store" });
        const j = await r.json();
        const t1 = performance.now();
        if (!alive) return;
        if (j?.ok && typeof j.starlink_ms === "number") {
          sync.current = { base: j.starlink_ms + (t1 - t0) / 2, mono: t1, syncedAt: Date.parse(j.synced_at) };
        }
      } catch {
        /* keep the last good sync until it goes stale */
      }
      if (alive) tick((n) => n + 1);
    };
    void load();
    const re = window.setInterval(load, RESYNC_MS);
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      alive = false;
      window.clearInterval(re);
      window.clearInterval(t);
    };
  }, []);

  const s = sync.current;
  if (s === null || performance.now() - s.mono >= STALE_MS) return { now: null, syncedAt: null };
  return { now: s.base + (performance.now() - s.mono), syncedAt: s.syncedAt };
}

export function StarlinkClock() {
  const { now, syncedAt } = useStarlinkTime();
  return (
    <div className="starlink-clock" role="timer" aria-live="off" title={TITLE}>
      <div className="sc-label">{LABEL}</div>
      {now !== null && syncedAt !== null ? (
        <>
          <div className="sc-time">{fmtWarsaw(now)}</div>
          <div className="sc-sync">ostatnia synchronizacja {fmtWarsaw(syncedAt)}</div>
        </>
      ) : (
        <div className="sc-time sc-none">{NO_SYNC}</div>
      )}
    </div>
  );
}
