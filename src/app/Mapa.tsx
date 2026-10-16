import { Component, useEffect, type ReactNode } from "react";
import { openGmina } from "../place";
import { s } from "../strings";
import { useStore } from "../store";
import { MapCanvas } from "../map/MapCanvas";
import { MapHud } from "../components/Chrome";
import { MapDetail } from "../components/MapDetail";
import { MapLayers, QuickChips } from "../components/MapLayers";
import { MapSearch } from "../components/MapSearch";
import { useMapFeeds, visibleLocal } from "../overlays";
import { StarlinkMapPanel } from "../components/StarlinkMapPanel";

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
  const notams = useStore((x) => x.airspace?.notam.items.length ?? 0);
  const local = useStore((x) => visibleLocal(x.localAlerts, x.localCats).length);
  useMapFeeds();
  // Deep link from a push notification or a shared link: /app/mapa?g=<gmina TERYT>.
  useEffect(() => {
    const g = new URLSearchParams(location.search).get("g");
    if (g && /^\d{6,7}$/.test(g)) void openGmina({ gmina: g }, true);
  }, []);
  const ua = fusion ? fusion.ua_alerts.filter((a) => a.active).length : 0;

  return (
    <main className="map live-map" aria-label={s("map.a11y")}>
      <MapErrorBoundary>
        <MapCanvas />
      </MapErrorBoundary>
      <MapHud />
      <StarlinkMapPanel />
      <div className="map-top">
        <MapSearch />
        <QuickChips />
      </div>
      <MapLayers />
      <MapDetail />
      {connecting && !fusion && <div className="map-status">{s("home.loading")}</div>}
      {fusion && (
        <div className="map-attr">
          NEPTUN {fusion.objects.length} · ADS-B {fusion.adsb.length} · UA {ua} · NOTAM {notams} · lokalne {local}
        </div>
      )}
    </main>
  );
}
