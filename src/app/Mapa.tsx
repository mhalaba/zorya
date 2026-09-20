import { Component, type ReactNode } from "react";
import { s } from "../strings";
import { useStore } from "../store";
import { MapCanvas } from "../map/MapCanvas";
import { MapHud } from "../components/Chrome";

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
  const connecting = useStore((x) => x.connecting);
  const fusion = useStore((x) => x.state);
  const ua = fusion ? fusion.ua_alerts.filter((a) => a.active).length : 0;

  return (
    <main className="map live-map" aria-label={s("map.a11y")}>
      <MapErrorBoundary>
        <MapCanvas />
      </MapErrorBoundary>
      <MapHud />
      {connecting && !fusion && <div className="map-status">{s("home.loading")}</div>}
      {fusion && (
        <div className="map-attr">
          NEPTUN {fusion.objects.length} · ADS-B {fusion.adsb.length} · UA {ua}
        </div>
      )}
    </main>
  );
}
