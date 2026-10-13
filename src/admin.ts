import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { FusionState, PowiatState } from "./types";

const powCache = new WeakMap<object, Map<string, PowiatState>>();

/** Powiat levels of a fusion state, decoded once per state object. */
export function powiatLevels(st: FusionState | null): Map<string, PowiatState> {
  const raw = st?.powiaty;
  if (!raw || !Array.isArray(raw.list)) return new Map();
  let m = powCache.get(raw);
  if (!m) {
    m = new Map(
      raw.list.map(([id, l, points, w, km]) => [
        id,
        { id, level: l === "p" ? "priority" : "watch", points, whyPl: (raw.why[w] ?? "").replace("{km}", km == null ? "?" : String(km)) },
      ])
    );
    powCache.set(raw, m);
  }
  return m;
}

/**
 * Powiaty and gminy for the map (TopoJSON from scripts/build-admin-geo.mjs). Powiaty + voivodeships come in one
 * file with the map; gminy are fetched per voivodeship only when the map is zoomed in on them.
 */

export interface PowiatProps {
  id: string;
  name: string;
  label: string;
  city: boolean;
  woj: string;
}

export interface GminaProps {
  id: string;
  name: string;
  kind: string;
  pow: string;
  woj: string;
}

export interface WojProps {
  id: string;
  name: string;
  teryt: string;
  east_rank: number;
}

type Area<P> = FeatureCollection<Polygon | MultiPolygon, P>;

export interface AdminLayers {
  powiaty: Area<PowiatProps>;
  woj: Area<WojProps>;
  /** [w, s, e, n] per voivodeship id — decides which gmina files the viewport needs. */
  wojBbox: Record<string, [number, number, number, number]>;
}

function bboxOf(f: Feature<Polygon | MultiPolygon>): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys)
    for (const [x, y] of p[0]) {
      a = Math.min(a, x);
      b = Math.min(b, y);
      c = Math.max(c, x);
      d = Math.max(d, y);
    }
  return [a, b, c, d];
}

let adminP: Promise<AdminLayers> | null = null;

export function loadAdmin(): Promise<AdminLayers> {
  adminP ??= fetch("/geo/pl-admin.topojson")
    .then((r) => {
      if (!r.ok) throw new Error(`pl-admin ${r.status}`);
      return r.json() as Promise<Topology>;
    })
    .then((t) => {
      const powiaty = feature(t, t.objects.powiaty as GeometryCollection<PowiatProps>) as unknown as Area<PowiatProps>;
      const woj = feature(t, t.objects.woj as GeometryCollection<WojProps>) as unknown as Area<WojProps>;
      const wojBbox: AdminLayers["wojBbox"] = {};
      for (const f of woj.features) wojBbox[f.properties.id] = bboxOf(f);
      return { powiaty, woj, wojBbox };
    })
    .catch((err) => {
      adminP = null; // a failed load may be retried on the next zoom
      throw err;
    });
  return adminP;
}

const gminyCache = new Map<string, Promise<Area<GminaProps>>>();

export function loadGminy(woj: string): Promise<Area<GminaProps>> {
  let p = gminyCache.get(woj);
  if (!p) {
    p = fetch(`/geo/gminy/${encodeURIComponent(woj)}.topojson`)
      .then((r) => {
        if (!r.ok) throw new Error(`gminy ${woj} ${r.status}`);
        return r.json() as Promise<Topology>;
      })
      .then((t) => feature(t, t.objects.gminy as GeometryCollection<GminaProps>) as unknown as Area<GminaProps>);
    p.catch(() => gminyCache.delete(woj));
    gminyCache.set(woj, p);
  }
  return p;
}

/** Voivodeships whose bounding box meets [w, s, e, n]. */
export function wojInView(layers: AdminLayers, view: [number, number, number, number]): string[] {
  return Object.entries(layers.wojBbox)
    .filter(([, b]) => b[0] <= view[2] && view[0] <= b[2] && b[1] <= view[3] && view[1] <= b[3])
    .map(([id]) => id);
}

export const GMINA_KIND: Record<string, string> = {
  miejska: "gmina miejska",
  wiejska: "gmina wiejska",
  "miejsko-wiejska": "gmina miejsko-wiejska",
};
