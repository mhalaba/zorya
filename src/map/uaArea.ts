/**
 * Is a point inside Ukraine? Used to keep NEPTUN's Polish-side fusion markers off Ukrainian territory, where the
 * own Ukraine tracker draws the threats (two different marker styles for the same drone only confuse).
 * The oblast polygons are the same file the map already loads (browser-cached); until they arrive nothing is hidden.
 */
type Ring = [number, number][];
let polys: { bbox: [number, number, number, number]; rings: Ring[] }[] | null = null;
let loading = false;
const ready: (() => void)[] = [];

/** Run cb once the outline is loaded (immediately if it already is). */
export function onUaAreaReady(cb: () => void) {
  if (polys) cb();
  else {
    ready.push(cb);
    load();
  }
}

function load() {
  if (polys || loading || typeof fetch === "undefined") return;
  loading = true;
  fetch("/geo/ua-oblasts.geojson")
    .then((r) => r.json())
    .then((fc: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
      const out: NonNullable<typeof polys> = [];
      for (const f of fc.features) {
        const g = f.geometry;
        const list = (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []) as Ring[][];
        for (const rings of list) {
          let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
          for (const [x, y] of rings[0]) {
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
          }
          out.push({ bbox: [x0, y0, x1, y1], rings });
        }
      }
      polys = out;
      for (const cb of ready.splice(0)) cb();
    })
    .catch(() => {
      loading = false;
    });
}

function inRing(x: number, y: number, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inUkraine(lon: number, lat: number): boolean {
  load();
  if (!polys) return false;
  for (const p of polys) {
    const [x0, y0, x1, y1] = p.bbox;
    if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
    if (inRing(lon, lat, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(lon, lat, h))) return true;
  }
  return false;
}
