import { useStore } from "./store";
import type { PlaceInfo } from "./types";

const cache = new Map<string, Promise<PlaceInfo | null>>();

function api(path: string) {
  const base = (useStore.getState().backendUrl || "").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Gmina of a point or a TERYT code via /api/place (cached: boundaries do not change while the page is open). */
export function fetchPlace(q: { lat: number; lon: number } | { gmina: string }): Promise<PlaceInfo | null> {
  const key = "gmina" in q ? `g:${q.gmina}` : `p:${q.lat.toFixed(5)},${q.lon.toFixed(5)}`;
  let p = cache.get(key);
  if (!p) {
    const qs = "gmina" in q ? `gmina=${encodeURIComponent(q.gmina)}` : `lat=${q.lat.toFixed(6)}&lon=${q.lon.toFixed(6)}`;
    p = fetch(api(`/api/place?${qs}`))
      .then((r) => (r.ok ? (r.json() as Promise<PlaceInfo>) : null))
      .catch(() => null);
    p.then((v) => v === null && cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Opens the gmina panel; `frame` also moves the map to the gmina (search, "my location"). */
export async function openGmina(q: { lat: number; lon: number } | { gmina: string }, frame = false): Promise<boolean> {
  const info = await fetchPlace(q);
  if (!info) return false;
  const st = useStore.getState();
  st.setSelectedGmina(info);
  if (frame) st.focusOn(info.gmina.bbox);
  return true;
}
