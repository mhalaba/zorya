/**
 * Trail hygiene shared by the own engine and the MAPA.UA fallback: a map trail shows the recent route only.
 * - time window: points older than TRAIL_WINDOW_MS before the newest one are dropped;
 * - length cap per kind, cut from the newest point backwards (the cut end is interpolated);
 * - a segment implying an impossible speed (when both ends carry a time) breaks the trail there.
 * Points are [lon, lat, ts?] (ts in ms, optional).
 */
import { distKm } from "./geo.mjs";

export const TRAIL_WINDOW_MS = 45 * 60_000;
export const TRAIL_KM = { drone_piston: 150, drone_jet: 250, missile_cruise: 400, missile_ballistic: 400, bomb: 60, drone_fpv: 20 };
/** Speed above which two consecutive fixes cannot be the same object (km/h, generous: reports lag). */
export const VMAX = { drone_piston: 280, drone_jet: 700, missile_cruise: 1100, missile_ballistic: 1e9, bomb: 1200, drone_fpv: 200 };

const d = (a, b) => distKm([a[1], a[0]], [b[1], b[0]]);

export function capTrail(points, kind, { windowMs = TRAIL_WINDOW_MS, maxKm = TRAIL_KM[kind] ?? 200 } = {}) {
  const pts = (points || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return pts;
  const lastTs = pts[pts.length - 1][2];
  const out = [pts[pts.length - 1]];
  let km = 0;
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i];
    const b = out[out.length - 1];
    if (Number.isFinite(a[2]) && Number.isFinite(lastTs) && lastTs - a[2] > windowMs) break;
    const seg = d(a, b);
    if (Number.isFinite(a[2]) && Number.isFinite(b[2]) && b[2] > a[2] && seg > 25) {
      const v = seg / ((b[2] - a[2]) / 3_600_000);
      if (v > (VMAX[kind] ?? 1e9) * 1.5) break;
    }
    if (km + seg > maxKm) {
      const f = (maxKm - km) / seg;
      if (f > 0.05) out.push([b[0] + (a[0] - b[0]) * f, b[1] + (a[1] - b[1]) * f]);
      break;
    }
    km += seg;
    out.push(a);
  }
  return out.reverse();
}
