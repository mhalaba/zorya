import { useEffect, useState } from "react";
import { useStore } from "../store";
import { Mapa } from "./Mapa";
import { useLiveFusion } from "../live";

/** App is the live map. Civic horizon, nav, and option panels stay off this path. */
export function AppShell() {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());
  useLiveFusion();

  useEffect(() => {
    if (useStore.persist.hasHydrated()) setHydrated(true);
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  if (!hydrated) {
    return <div className="app-root map-view" />;
  }

  return (
    <div className="app-root map-view">
      <Mapa />
    </div>
  );
}
