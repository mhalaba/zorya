import { useEffect, useRef, useState } from "react";

// Top-right clock showing time from the Starlink dish's NTP server (via /api/starlink-time).
// Between syncs it ticks with performance.now(); it never shows the browser's own clock.
const RESYNC_MS = 60_000;
const STALE_MS = 3 * 60_000;
const TZ = "Europe/Warsaw";

const fmt = (ms: number, seconds = true) =>
  new Intl.DateTimeFormat("pl-PL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hour12: false,
  }).format(new Date(ms));

type Sync = { base: number; mono: number; syncedAt: number };

export function StarlinkClock() {
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
  const fresh = s !== null && performance.now() - s.mono < STALE_MS;
  return (
    <div
      className="starlink-clock"
      role="timer"
      aria-live="off"
      title="Czas z serwera czasu NTP anteny Starlink (GPS, 192.168.100.1), odczytywany przez serwer Zoryi. To nie jest zegar Twojego urządzenia."
    >
      <div className="sc-label">Czas Starlink (serwer czasu Starlinka, GPS) · Europe/Warsaw</div>
      {s && fresh ? (
        <>
          <div className="sc-time">{fmt(s.base + (performance.now() - s.mono))}</div>
          <div className="sc-sync">ostatnia synchronizacja {fmt(s.syncedAt)}</div>
        </>
      ) : (
        <div className="sc-time sc-none">brak synchronizacji ze Starlinkiem</div>
      )}
    </div>
  );
}
