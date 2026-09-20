import { Component, useEffect, useState, type ReactNode } from "react";
import { s } from "../strings";
import { useStore } from "../store";
import { MapCanvas } from "../map/MapCanvas";
import { LiveMapTools } from "../components/Chrome";
import { Drawers } from "../components/Drawers";

class MapErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(err: Error) {
    return { err: err.message || "mapa" };
  }
  render() {
    if (this.state.err) {
      return <div className="map-status">Mapa wymaga WebGL ({this.state.err})</div>;
    }
    return this.props.children;
  }
}

export function Mapa() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const offline = useStore((x) => x.offline);
  const connecting = useStore((x) => x.connecting);
  const fusion = useStore((x) => x.state);

  return (
    <main className={`map live-map${offline ? " greyed" : ""}`} aria-label={s("map.a11y")}>
      <MapErrorBoundary>
        <MapCanvas />
      </MapErrorBoundary>
      <LiveMapTools />
      {connecting && !fusion && <div className="map-status">{s("home.loading")}</div>}
      {fusion && (
        <div className="map-attr">
          NEPTUN {fusion.objects.length} · ADS-B {fusion.adsb.length} · UA {fusion.ua_alerts.filter((a) => a.active).length}
        </div>
      )}
      <Drawers now={now} />
    </main>
  );
}
