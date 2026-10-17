/**
 * Events → tracked objects. Each parsed event either updates the nearest compatible object (same weapon
 * group, reachable at the typical speed since its last fix, or heading to the same town) or starts a new one.
 * Positions are estimates: a "на X" report without a fix is placed a few minutes' flight before X along the
 * incoming bearing. Objects go "lost" after a kind-specific silence and disappear 60 min after the last fix.
 */
import { OBLAST_BY_ID, ZONES, bearing, distKm, move } from "./geo.mjs";
import { SPEED } from "./parse.mjs";
import { VMAX, capTrail } from "./trail.mjs";

const MIN = 60_000;
/** How long an object stays "active" without a new report. */
export const TTL = { drone_piston: 30 * MIN, drone_jet: 15 * MIN, missile_cruise: 10 * MIN, missile_ballistic: 4 * MIN, bomb: 5 * MIN };
/** Lost / shot-down markers stay visible (grey) this long, then leave the map. */
const DEAD_SHOW_MS = 10 * MIN;
const KEEP_MS = 60 * MIN;
/** Distance (km) before the named target where a "на X" report places the object. */
const LEAD_KM = { drone_piston: 30, drone_jet: 50, missile_cruise: 50, missile_ballistic: 0, bomb: 12 };
const TRAIL_MAX = 60;
/** A launch zone is drawn as the first trail point only when it is this close to the first fix. */
const ORIGIN_TRAIL_MAX_KM = 150;
const REPORTS_MAX = 8;

/**
 * Where strikes usually come from when a report gives no origin. Measured on MAPA.UA tracks (attack of 17.10.2026):
 * north and centre (lat >= 48) are approached from the north-east (Bryansk / Kursk / Belgorod, bearing 210-245°),
 * the south from Crimea / occupied Zaporizhzhia (bearing ~315°).
 */
const NORTH_ORIGINS = [
  [52.35, 33.6], // Bryansk border
  [51.3, 35.3], // Kursk border
  [50.4, 36.8], // Belgorod border
];
const SOUTH_ORIGINS = [
  [45.2, 33.9], // Crimea
  [47.2, 35.9], // occupied Zaporizhzhia
  [48.05, 38.0], // occupied Donbas
];

/** Dead reckoning: share of the nominal speed assumed between reports (routes zig-zag, reports lag). */
const DR_FACTOR = Number(process.env.UA_TRACKER_DR_FACTOR || 0.8);

/** Estimated position now: the last fix advanced along the heading at the typical speed, stopping at the target. */
export function estimate(o, now) {
  const here = [o.lat, o.lon];
  if (o.status !== "active" || o.heading == null) return here;
  const dtH = Math.min(Math.max(0, now - o.last_seen), TTL[o.kind] || 0) / 3600_000;
  let km = (o.speed_kmh || SPEED[o.kind] || 165) * dtH * DR_FACTOR;
  if (!o.target) return km > 0.5 ? move(here, o.heading, Math.min(km, 60)) : here;
  const rest = Math.max(0, distKm(here, o.target) - 2);
  if (km <= rest) return km > 0.5 ? move(here, bearing(here, o.target), km) : here;
  // Past the named town: carry on towards the next waypoint ("на X / Y") if the report gave one.
  if (o.next && distKm(o.target, o.next) > 3) return move(o.target, bearing(o.target, o.next), Math.min(km - rest, Math.max(0, distKm(o.target, o.next) - 2)));
  return rest > 0.5 ? move(here, bearing(here, o.target), rest) : here;
}

/** After reaching the named town (and the next waypoint, if any) an object without news is over. */
const ARRIVED_GRACE_MS = 8 * MIN;
function arrived(o, now, grace = 0) {
  if (!o.target || o.status !== "active") return false;
  const sp = ((o.speed_kmh || SPEED[o.kind] || 165) * DR_FACTOR) / 60; // km per minute
  let km = distKm([o.lat, o.lon], o.target);
  if (o.next) km += distKm(o.target, o.next);
  return now - o.last_seen > (km / sp) * MIN + grace;
}

const group = (k) => (k?.startsWith("drone") ? "drone" : k?.startsWith("missile") ? k : k || "?");
const ll = (p) => [p.lat, p.lon];

function originPoint(ev, target) {
  if (ev.from?.zone && ZONES[ev.from.zone]) return { p: ZONES[ev.from.zone].c, zone: ev.from.zone };
  if (ev.from?.oblast && OBLAST_BY_ID.get(ev.from.oblast)) return { p: OBLAST_BY_ID.get(ev.from.oblast).c, oblast: ev.from.oblast };
  if (ev.from?.compass != null) return { p: move(target, ev.from.compass, 60) };
  // "Бандероль" (S8000) is launched from the occupied south.
  const list = target[0] >= 48 && ev.subkind !== "banderol" ? NORTH_ORIGINS : SOUTH_ORIGINS;
  let best = list[0];
  for (const o of list) if (distKm(o, target) < distKm(best, target)) best = o;
  return { p: best, guessed: true };
}

export class Engine {
  constructor() {
    this.objects = new Map();
    this.seq = 0;
    this.changed = new Set();
  }

  load(list, now = Date.now()) {
    for (const o of list || []) if (o && now - o.last_seen < KEEP_MS) this.objects.set(o.id, o);
  }

  newId(t) {
    this.seq = (this.seq + 1) % 1e6;
    return `z${Math.floor(t / 1000).toString(36)}${this.seq.toString(36)}`;
  }

  /** meta: { channel, msgId, url, ts, weight, text } → object id */
  ingest(ev, meta) {
    const t = meta.ts;
    const sp = ev.speed_kmh || SPEED[ev.kind] || 165;
    const pos = ev.pos ? ll(ev.pos) : null;
    const tgt = ev.target ? ll(ev.target) : null;
    const probe = pos || tgt;
    if (!probe) return null;

    // ---- find a matching object
    let best = null;
    for (const o of this.objects.values()) {
      if (group(o.kind) !== group(ev.kind)) continue;
      if (o.status === "eliminated" || o.status === "hit_target") continue;
      if (o._msg === `${meta.channel}/${meta.msgId}`) continue; // one post lists distinct objects
      const dtMin = (t - o.last_seen) / MIN;
      if (dtMin < -15 || dtMin > TTL[o.kind] / MIN + 10) continue;
      const last = estimate(o, t);
      const osp = SPEED[o.kind] || 165;
      let reach = 20 + (osp * Math.max(dtMin, 0) * 1.3) / 60;
      // Jet and piston drones fly at 450 vs 165 km/h: different objects unless it is clearly the same fix.
      if (o.kind !== ev.kind) {
        if (!pos || dtMin > 5) continue;
        reach = 10;
      }
      // A fix the object cannot have reached since its last fix (at a generous max speed) is another object.
      if (pos) {
        const jump = distKm([o.lat, o.lon], pos);
        const dtH = Math.max(Math.abs(t - o.last_seen), 8 * MIN) / 3600_000; // reports lag: 8 min floor
        if (jump > 25 && jump / dtH > (VMAX[o.kind] ?? 1e9)) continue;
      }
      const sameTarget = o.target && tgt && distKm(o.target, tgt) < 12;
      const d = pos ? distKm(last, pos) : distKm(last, tgt);
      let score = null;
      if (sameTarget && d < reach + 60) score = d - 50;
      else if (pos && d <= reach) score = d;
      else if (!pos && d <= reach + LEAD_KM[ev.kind] + 25) score = d - 10;
      if (score == null) continue;
      if (!best || score < best.score) best = { o, score };
    }

    const report = { channel: meta.channel, msg_id: meta.msgId, url: meta.url, ts: t, text: ev.line };
    let o = best?.o;
    if (!o) {
      // ---- new object
      let point = pos;
      let trail = [];
      let fromZone = null;
      if (!point) {
        const org = originPoint(ev, tgt);
        fromZone = org.zone || null;
        const dist = distKm(tgt, org.p);
        point = move(tgt, bearing(tgt, org.p), Math.min(LEAD_KM[ev.kind] ?? 15, dist / 2));
        if (org.zone && distKm(org.p, point) <= ORIGIN_TRAIL_MAX_KM) trail.push([org.p[1], org.p[0], t - Math.round((distKm(org.p, point) / sp) * 3600_000)]);
      } else if (ev.from?.zone && ZONES[ev.from.zone]) {
        fromZone = ev.from.zone;
        const zp = ZONES[ev.from.zone].c;
        if (distKm(zp, point) <= ORIGIN_TRAIL_MAX_KM) trail.push([zp[1], zp[0], t - Math.round((distKm(zp, point) / sp) * 3600_000)]);
      }
      trail.push([point[1], point[0], t]);
      o = {
        id: this.newId(t),
        kind: ev.kind,
        subkind: ev.subkind || null,
        amount: ev.count || 1,
        status: "active",
        lat: point[0],
        lon: point[1],
        heading: null,
        speed_kmh: sp,
        trail,
        target: tgt,
        next: ev.next?.lat != null ? ll(ev.next) : null,
        to_name: ev.target?.name || null,
        next_name: ev.next?.name || (ev.next?.oblast ? OBLAST_BY_ID.get(ev.next.oblast)?.uk : null) || null,
        from_zone: fromZone,
        from_name: fromZone ? ZONES[fromZone].name : ev.from?.oblast ? OBLAST_BY_ID.get(ev.from.oblast)?.uk || null : null,
        oblast: ev.oblast || null,
        first_seen: t,
        last_seen: t,
        alive: t,
        sources: {},
        reports: [],
      };
      this.objects.set(o.id, o);
    } else {
      // ---- update (posts can arrive out of order across channels: older news never overrides newer)
      const newer = t >= o.last_seen;
      if (newer) {
        const last = [o.lat, o.lon];
        const dtH = Math.max(0, (t - o.last_seen) / 3600_000);
        let point;
        if (pos) point = pos;
        else {
          const d = distKm(last, tgt);
          const step = Math.min(sp * dtH, Math.max(0, d - (LEAD_KM[ev.kind] ?? 15) / 3));
          point = step > 0.5 ? move(last, bearing(last, tgt), step) : last;
        }
        if (distKm(last, point) > 2) o.trail.push([point[1], point[0], t]);
        if (o.trail.length > TRAIL_MAX) o.trail = o.trail.slice(-TRAIL_MAX);
        o.lat = point[0];
        o.lon = point[1];
        o.last_seen = t;
        if (tgt) {
          o.target = tgt;
          o.next = ev.next?.lat != null ? ll(ev.next) : null;
          o.to_name = ev.target.name;
          o.next_name = ev.next?.name || (ev.next?.oblast ? OBLAST_BY_ID.get(ev.next.oblast)?.uk : null) || null;
        }
        if (ev.speed_kmh) o.speed_kmh = ev.speed_kmh;
        o.oblast = ev.oblast || o.oblast;
        if (o.status === "lost") o.status = "active";
      }
      // Older news from a slower channel never goes into the trail: inserting it drew back-and-forth zig-zags.
      if (ev.kind === "drone_jet" && o.kind === "drone_piston" && meta.weight >= 0.8 && o.amount === 1 && (ev.count || 1) === 1) o.kind = "drone_jet";
      if (ev.subkind && !o.subkind) o.subkind = ev.subkind;
      o.amount = Math.max(o.amount, ev.count || 1);
    }
    o.alive = Math.max(o.alive || 0, t);
    if (o.status === "active") delete o.dead_at;
    // heading: explicit compass > towards target > along the last trail segment
    const here = [o.lat, o.lon];
    if (ev.heading != null) o.heading = ev.heading;
    else if (o.target && distKm(here, o.target) > 1) o.heading = Math.round(bearing(here, o.target));
    else if (o.trail.length >= 2) {
      const a = o.trail[o.trail.length - 2];
      o.heading = Math.round(bearing([a[1], a[0]], here));
    }
    const s = (o.sources[meta.channel] ||= { w: meta.weight, n: 0, last: 0 });
    s.n += 1;
    s.last = Math.max(s.last, t);
    if (!o.reports.some((r) => r.url === report.url && r.text === report.text)) {
      o.reports.push(report);
      o.reports.sort((a, b) => a.ts - b.ts);
      if (o.reports.length > REPORTS_MAX) o.reports = o.reports.slice(-REPORTS_MAX);
    }
    o._msg = `${meta.channel}/${meta.msgId}`;
    this.changed.add(o.id);
    return o.id;
  }

  /** Report of a shoot-down: the nearest compatible live object, or the channel's latest one. */
  kill(k, meta) {
    const t = meta.ts;
    let best = null;
    for (const o of this.objects.values()) {
      if (o.status !== "active") continue;
      if (k.kind && group(o.kind) !== group(k.kind)) continue;
      if (t - o.last_seen > 30 * MIN) continue;
      let score;
      if (k.place) {
        const d = distKm([o.lat, o.lon], ll(k.place));
        if (d > 40) continue;
        score = d;
      } else {
        const s = o.sources[meta.channel];
        if (!s || t - s.last > 10 * MIN) continue;
        score = (t - s.last) / MIN;
      }
      if (!best || score < best.score) best = { o, score };
    }
    if (!best) return null;
    const o = best.o;
    if (o.amount > 1) o.amount -= 1;
    else {
      o.status = "eliminated";
      o.dead_at = t;
    }
    o.reports.push({ channel: meta.channel, msg_id: meta.msgId, url: meta.url, ts: t, text: k.line });
    if (o.reports.length > REPORTS_MAX) o.reports = o.reports.slice(-REPORTS_MAX);
    this.changed.add(o.id);
    return o.id;
  }

  /** All-clear for an oblast, a raion (place) or everything: objects there without a fresh report become "lost". */
  clear(c, meta) {
    const t = meta.ts;
    let n = 0;
    for (const o of this.objects.values()) {
      if (o.status !== "active") continue;
      if (c.place) {
        if (distKm([o.lat, o.lon], [c.place.lat, c.place.lon]) > 40) continue;
      } else if (!c.all && (!c.oblast || o.oblast !== c.oblast)) continue;
      if (t - o.last_seen < (c.all ? 10 : 5) * MIN) continue;
      o.status = "lost";
      o.dead_at = t;
      this.changed.add(o.id);
      n++;
    }
    return n;
  }

  /** Region-level mention ("Чернігівщина — 3х БпЛА"): keeps matching objects alive without moving them. */
  regional(r, meta) {
    for (const o of this.objects.values()) {
      if (o.oblast === r.oblast && group(o.kind) === group(r.kind) && o.status !== "eliminated") {
        if (meta.ts - o.last_seen < TTL[o.kind] / 2 && !arrived(o, meta.ts)) o.alive = Math.max(o.alive || 0, meta.ts);
      }
    }
  }

  tick(now = Date.now()) {
    for (const o of this.objects.values()) {
      if (now - o.last_seen > KEEP_MS && now - (o.alive || 0) > KEEP_MS) {
        this.objects.delete(o.id);
        this.changed.add(o.id);
        continue;
      }
      if (o.status === "active" && (now - Math.max(o.last_seen, o.alive || 0) > TTL[o.kind] || arrived(o, now, ARRIVED_GRACE_MS))) {
        o.status = "lost";
        o.dead_at = now;
        this.changed.add(o.id);
      }
    }
  }

  /**
   * Quiet sky elsewhere (MAPA.UA shows nothing live): every own object without a report for `quietMs` is lost.
   */
  ageOut(quietMs, now = Date.now()) {
    let n = 0;
    for (const o of this.objects.values()) {
      if (o.status === "active" && now - Math.max(o.last_seen, o.alive || 0) > quietMs) {
        o.status = "lost";
        o.dead_at = now;
        this.changed.add(o.id);
        n++;
      }
    }
    return n;
  }

  /** Objects in the /api/ua-threats shape (times in ms), newest first. */
  snapshot(now = Date.now()) {
    const out = [];
    for (const o of this.objects.values()) {
      if (now - o.last_seen > KEEP_MS) continue;
      if (o.status !== "active" && now - (o.dead_at || o.last_seen) > DEAD_SHOW_MS) continue;
      const w = Object.values(o.sources).map((s) => s.w);
      const confidence = Math.round((1 - w.reduce((p, x) => p * (1 - x), 1)) * 100) / 100;
      const est = estimate(o, now);
      let predicted = null;
      if (o.status === "active" && o.heading != null) {
        let km = ((o.speed_kmh || SPEED[o.kind]) * 10) / 60;
        if (o.target) km = Math.min(km, distKm(est, o.target));
        if (km > 1) {
          const p = move(est, o.heading, km);
          predicted = [p[1], p[0]];
        }
      }
      const tr = [...o.trail];
      const tl = tr[tr.length - 1];
      if (!tl || distKm([tl[1], tl[0]], est) > 1) tr.push([est[1], est[0], Math.max(now, tl?.[2] || 0)]);
      // Only the recent route: last 45 min, at most a kind-specific length, never across an impossible jump.
      const trail = capTrail(tr, o.kind).map((p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
      const last = o.reports[o.reports.length - 1];
      out.push({
        id: o.id,
        kind: o.kind,
        subkind: o.subkind || null,
        amount: o.amount,
        title: last?.text || "",
        status: o.status,
        heading: o.heading,
        speed_kmh: o.speed_kmh,
        lat: est[0],
        lon: est[1],
        fix: [o.lon, o.lat],
        fix_ts: o.last_seen,
        predicted,
        trail,
        first_seen: o.first_seen,
        last_seen: o.last_seen,
        from_zone: o.from_zone,
        from_name: o.from_name,
        to_city: o.to_name,
        to_name: o.next_name ? `${o.to_name} → ${o.next_name}` : o.to_name,
        source: "own",
        confidence,
        channels: Object.keys(o.sources),
        reports: o.reports.map((r) => ({ channel: r.channel, url: r.url, ts: r.ts, text: r.text })),
      });
    }
    return out.sort((a, b) => b.last_seen - a.last_seen);
  }

  /** Changed objects since the last call (for persistence): [{id, obj|null}]. */
  drainChanged() {
    const ids = [...this.changed];
    this.changed.clear();
    return ids.map((id) => ({ id, obj: this.objects.get(id) || null }));
  }
}
