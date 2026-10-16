import { useEffect, useState } from "react";
import { LABEL, NO_SYNC, TITLE, fmtWarsaw, useStarlinkTime } from "../site/StarlinkClock";

// Map (/app/mapa) top-right: Starlink time + what the Starlink dish reports (GPS satellites, state).
type Dish = { ok: boolean; state?: string | null; gps_sats?: number; gps_valid?: boolean };

const STATE_PL: Record<string, string> = {
  CONNECTED: "połączona",
  SEARCHING: "szuka satelitów",
  BOOTING: "uruchamia się",
  DISCONNECTED: "rozłączona",
  OFFLINE: "offline",
};

export function StarlinkMapPanel() {
  const { now, syncedAt } = useStarlinkTime();
  const [dish, setDish] = useState<Dish | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/starlink-dish", { cache: "no-store" });
        const j = (await r.json()) as Dish;
        if (alive) setDish(j);
      } catch {
        if (alive) setDish({ ok: false });
      }
    };
    void load();
    const t = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const dishOk = dish?.ok && typeof dish.gps_sats === "number";
  const state = dish?.state ? STATE_PL[dish.state] ?? dish.state.toLowerCase() : null;
  return (
    <div
      className="starlink-map"
      role="status"
      aria-live="off"
      title={`${TITLE} Satelity GPS i stan: odczyt z anteny Starlink (gRPC get_status).`}
    >
      <div className="sm-label">
        <span className="sm-long">{LABEL}</span>
        <span className="sm-short">Czas Starlink (GPS)</span>
      </div>
      {now !== null && syncedAt !== null ? (
        <>
          <div className="sm-time">{fmtWarsaw(now)}</div>
          <div className="sm-sub">ostatnia synchronizacja {fmtWarsaw(syncedAt)}</div>
        </>
      ) : (
        <div className="sm-time sm-none">{NO_SYNC}</div>
      )}
      {dishOk ? (
        <>
          <div className="sm-sats">
            <span className="sm-long">Satelity GPS widoczne przez antenę Starlink: </span>
            <span className="sm-short">Satelity GPS (antena Starlink): </span>
            <b>{dish!.gps_sats}</b>
          </div>
          {state && <div className="sm-sub">Antena Starlink: {state}</div>}
        </>
      ) : (
        <div className="sm-sub sm-none">{dish ? "brak danych z anteny" : "…"}</div>
      )}
    </div>
  );
}
