/**
 * Zorya's own tracker of Russian air threats over Ukraine (drones, missiles, KAB).
 *
 * 1. Ingest: public Telegram previews (t.me/s/<channel>), one request at a time, each channel every 30–60 s.
 * 2. Parse: deterministic uk/ru rules + GeoNames gazetteer (parse.mjs). No AI.
 * 3. Engine: events → objects with trails, dedup across channels, TTL, source weighting (engine.mjs).
 * 4. Fallback: MAPA.UA and NEPTUN objects are added ONLY where our engine has nothing nearby.
 *
 * Kill switches (env, then `docker compose up -d`): UA_TRACKER_ENABLED=0 (own ingest off),
 * UA_TRACKER_FALLBACK_MAPAUA=0, UA_TRACKER_FALLBACK_NEPTUN=0 (MAPAUA_ENABLED=0 also stops MAPA.UA polling).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { distKm } from "./geo.mjs";
import { parsePost } from "./parse.mjs";
import { Engine } from "./engine.mjs";
import { fetchChannel } from "./telegram.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const flag = (name, def = "1") => !/^(0|false|off|no)$/i.test(String(process.env[name] ?? def).trim());
export const OWN_ENABLED = flag("UA_TRACKER_ENABLED");
const FB_MAPAUA = flag("UA_TRACKER_FALLBACK_MAPAUA");
// NEPTUN is off by default: the own engine reads the channels of NEPTUN's public registry itself.
const FB_NEPTUN = flag("UA_TRACKER_FALLBACK_NEPTUN", "0");
const TICK_MS = 1000;
const JITTER = 0.15; // ±15% on every interval so channels do not line up
const PAUSE_ON_429_MS = 90_000; // t.me rate limit: every channel waits
const BOOTSTRAP_MS = 45 * 60_000; // first ever run: replay the last 45 min of each channel
const LAST_KIND_MS = 5 * 60_000;
const FALLBACK_NEAR_KM = 40;
const FALLBACK_MAX_AGE_MS = 20 * 60_000;
const EVENTS_RING = 500;

const cfg = JSON.parse(fs.readFileSync(path.join(here, "channels.json"), "utf8"));
const CHANNELS = cfg.channels.filter((c) => c.enabled !== false);
const DEFAULT_POLL_MS = Math.max(30, Number(process.env.UA_TRACKER_POLL_S) || cfg.poll_s || 90) * 1000;
const baseMs = (c) => Math.max(30_000, (c.poll_s || 0) * 1000 || DEFAULT_POLL_MS);
const jitter = (ms) => Math.round(ms * (1 - JITTER + Math.random() * 2 * JITTER));
let pausedUntil = 0;

const engine = new Engine();
let store = null;
let timer = null;
const startedAt = Date.now();
const ring = [];
const ch = new Map(
  CHANNELS.map((c, i) => [
    c.name,
    {
      cfg: c,
      next: Date.now() + i * 1500, // stagger the first round
      lastId: null,
      fails: 0,
      ok: null,
      error: null,
      fetched_at: null,
      last_post_ts: null,
      posts: 0,
      posts_with_events: 0,
      events: 0,
      lastKind: null,
      lastKindTs: 0,
    },
  ])
);
const stats = { posts: 0, events: 0, kills: 0, clears: 0, regional: 0, unparsed: 0, fetches: 0, fetch_errors: 0 };
const unparsedSample = [];
/** Fallback objects that were shown, by source, since start (unique ids). */
const fbSeen = { "mapa.ua": new Set(), neptun: new Set() };
const ownSeen = new Set();

let getMapaUa = () => null;
let getNeptun = () => null;

function pushRing(e) {
  ring.push(e);
  if (ring.length > EVENTS_RING) ring.splice(0, ring.length - EVENTS_RING);
}

function record(type, st, m, e, objectId) {
  const row = {
    ts: Number.isFinite(m.ts) ? m.ts : Date.now(),
    channel: st.cfg.name,
    msg_id: m.id,
    url: `https://t.me/${st.cfg.name}/${m.id}`,
    type,
    kind: e.kind || null,
    count: e.count || null,
    oblast: e.oblast || null,
    place: e.pos?.name || e.place?.name || null,
    lat: e.pos?.lat ?? e.place?.lat ?? null,
    lon: e.pos?.lon ?? e.place?.lon ?? null,
    target: e.target?.name || null,
    tlat: e.target?.lat ?? null,
    tlon: e.target?.lon ?? null,
    from_zone: e.from?.zone || (e.from?.oblast ? `oblast:${e.from.oblast}` : e.from?.compass != null ? `compass:${e.from.compass}` : null),
    object_id: objectId || null,
    line: e.line || null,
  };
  pushRing(row);
  try {
    store?.addEvent(row);
  } catch (err) {
    console.error("ua-tracker event", err.message || err);
  }
}

export function processPost(st, m) {
  const now = Date.now();
  const lastKind = now - st.lastKindTs < LAST_KIND_MS ? st.lastKind : null;
  const r = parsePost(m.text, { oblast: st.cfg.oblast || null, defaultKind: st.cfg.defaultKind || null, national: !!st.cfg.national, lastKind });
  const meta = { channel: st.cfg.name, msgId: m.id, url: `https://t.me/${st.cfg.name}/${m.id}`, ts: Number.isFinite(m.ts) ? m.ts : now, weight: st.cfg.weight ?? 0.6 };
  let n = 0;
  for (const e of r.events) {
    const id = engine.ingest(e, meta);
    record("track", st, m, e, id);
    if (id) ownSeen.add(id);
    st.lastKind = e.kind;
    st.lastKindTs = meta.ts;
    n++;
  }
  for (const k of r.kills) {
    const id = engine.kill(k, meta);
    record("kill", st, m, k, id);
    stats.kills++;
  }
  for (const c of r.clears) {
    engine.clear(c, meta);
    record("clear", st, m, c, null);
    stats.clears++;
  }
  for (const g of r.regional) {
    engine.regional(g, meta);
    stats.regional++;
  }
  for (const u of r.unparsed) {
    stats.unparsed++;
    unparsedSample.push({ channel: st.cfg.name, url: meta.url, line: u.slice(0, 200) });
    if (unparsedSample.length > 30) unparsedSample.shift();
  }
  stats.posts++;
  stats.events += n;
  st.posts++;
  st.events += n;
  if (n) st.posts_with_events++;
  try {
    store?.addPost(st.cfg.name, m, n);
  } catch (err) {
    console.error("ua-tracker post", err.message || err);
  }
  return r;
}

async function pollOne(st) {
  stats.fetches++;
  try {
    const msgs = await fetchChannel(st.cfg.name);
    const now = Date.now();
    const fresh = msgs.filter((m) => (st.lastId == null ? now - m.ts <= BOOTSTRAP_MS : m.id > st.lastId));
    for (const m of fresh) processPost(st, m);
    if (msgs.length) {
      st.lastId = Math.max(st.lastId ?? 0, msgs[msgs.length - 1].id);
      st.last_post_ts = msgs[msgs.length - 1].ts;
      // Remember the high-water mark even when the newest posts were older than the bootstrap window.
      if (!fresh.length) store?.addPost(st.cfg.name, { ...msgs[msgs.length - 1], text: "" }, 0);
    }
    st.ok = true;
    st.error = null;
    st.fails = 0;
    st.fetched_at = now;
    st.next = now + jitter(baseMs(st.cfg));
  } catch (err) {
    stats.fetch_errors++;
    st.fails++;
    st.ok = false;
    st.error = String(err.name === "AbortError" ? "timeout" : err.message || err).slice(0, 120);
    if (err.retry) {
      pausedUntil = Date.now() + PAUSE_ON_429_MS;
      stats.rate_limited = (stats.rate_limited || 0) + 1;
    }
    st.next = Date.now() + jitter(Math.min(15 * 60_000, baseMs(st.cfg) * 2 ** Math.min(st.fails, 5)));
    if (st.fails <= 2 || st.fails % 20 === 0) console.error(`ua-tracker ${st.cfg.name} (#${st.fails})`, st.error);
  }
}

let busy = false;
let lastSave = 0;
let lastPrune = 0;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const now = Date.now();
    let due = null;
    if (now >= pausedUntil) for (const st of ch.values()) if (st.next <= now && (!due || st.next < due.next)) due = st;
    if (due) await pollOne(due);
    engine.tick(Date.now());
    if (store && Date.now() - lastSave > 10_000) {
      lastSave = Date.now();
      const changes = engine.drainChanged();
      if (changes.length) store.saveObjects(changes);
    }
    if (store && Date.now() - lastPrune > 3600_000) {
      lastPrune = Date.now();
      store.prune();
    }
  } catch (err) {
    console.error("ua-tracker tick", err.message || err);
  } finally {
    busy = false;
  }
}

/**
 * Start the tracker. deps: { mapaUa: () => snapshot from server/mapaua.mjs, neptun: () => { at, threats } }.
 * A storage failure leaves the tracker running in memory only.
 */
export async function startUaTracker({ dataDir, mapaUa, neptun } = {}) {
  if (mapaUa) getMapaUa = mapaUa;
  if (neptun) getNeptun = neptun;
  if (!OWN_ENABLED || timer) return;
  try {
    const { openStore } = await import("./store.mjs");
    store = openStore(path.join(dataDir || "data", "uatracker.sqlite"));
    const ids = store.lastIds();
    for (const [name, id] of ids) if (ch.has(name)) ch.get(name).lastId = id;
    engine.load(store.liveObjects(Date.now() - 3600_000));
    for (const r of store.recentEvents(Date.now() - 3 * 3600_000, EVENTS_RING).reverse()) pushRing({ ...r, url: `https://t.me/${r.channel}/${r.msg_id}` });
  } catch (err) {
    store = null;
    console.error("ua-tracker storage disabled", err.message || err);
  }
  timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  console.log(`ua-tracker: ${CHANNELS.length} channels, fallback mapa.ua=${FB_MAPAUA} neptun=${FB_NEPTUN}`);
}

// ---- fallback merge ------------------------------------------------------------------------------
const groupOf = (k) => (String(k).startsWith("drone") ? "drone" : String(k).startsWith("missile") ? "missile" : k);

function neptunKind(t) {
  const blob = `${t.type || ""} ${t.title || ""} ${t.explanationShort || ""}`.toLowerCase();
  if (/fpv|lancet|ланцет|молні|recon|розвід|aircraft|helicopter|mig|авіац|літак/.test(blob)) return null;
  if (t.type === "ballistic" || /ballist|баліст/.test(blob)) return "missile_ballistic";
  if (t.type === "kab" || /каб|авіабомб|bomb/.test(blob)) return "bomb";
  if (t.type === "missile" || /cruise|крилат|ракет|missile/.test(blob)) return "missile_cruise";
  if (/реактив|jet/.test(blob)) return "drone_jet";
  if (t.type === "uav" || t.type === "shahed" || /shahed|шахед|бпла|uav|drone|дрон/.test(blob)) return "drone_piston";
  return null;
}

function compatible(a, b) {
  return groupOf(a) === groupOf(b);
}

// Only an own object of the same weapon group hides a fallback one (an own jet drone near Kremenets must not
// hide MAPA.UA's cruise missile there), and only within 40 km.
function nearAny(list, kind, lat, lon) {
  return list.some((o) => {
    if (!compatible(o.kind, kind)) return false;
    const km = FALLBACK_NEAR_KM;
    if (distKm([o.lat, o.lon], [lat, lon]) <= km) return true;
    const p = o.predicted;
    return p ? distKm([p[1], p[0]], [lat, lon]) <= km : false;
  });
}

let mergedCache = null;
let mergedAt = 0;
/** Own objects + fallback objects that our engine did not catch. Same shape as /api/ua-threats. */
export function mergedSnapshot() {
  const now = Date.now();
  if (mergedCache && now - mergedAt < 5000) return mergedCache;
  const mua = getMapaUa() || null;
  // MAPA.UA sees a clear sky (nothing live in 15 min): our silent objects (no report for 10 min) are lost too.
  const muaQuiet =
    !!mua?.enabled && mua.ok && !(mua.objects || []).some((o) => o.status === "active" && now - o.last_seen < 15 * 60_000);
  if (OWN_ENABLED && muaQuiet) engine.ageOut(10 * 60_000, now);
  const own = OWN_ENABLED ? engine.snapshot(now) : [];
  for (const o of own) ownSeen.add(o.id);
  // Only live own objects may hide a fallback object: a "lost"/shot-down own marker must not mask an active one.
  const ownLive = own.filter((o) => o.status === "active");
  const objects = [...own];
  const added = { "mapa.ua": 0, neptun: 0 };
  const skipped = { "mapa.ua": 0, neptun: 0 };
  if (FB_MAPAUA && mua?.enabled) {
    for (const o of mua.objects || []) {
      if (now - o.last_seen > FALLBACK_MAX_AGE_MS) continue;
      if (nearAny(ownLive, o.kind, o.lat, o.lon)) {
        skipped["mapa.ua"]++;
        continue;
      }
      const x = { ...o, id: `m:${o.id}`, source: "mapa.ua", confidence: null, channels: [], reports: [] };
      objects.push(x);
      fbSeen["mapa.ua"].add(x.id);
      added["mapa.ua"]++;
    }
  }
  const nep = getNeptun() || null;
  if (FB_NEPTUN && nep?.threats) {
    const base = objects.filter((o) => o.status === "active");
    for (const t of nep.threats) {
      if (!t || t.status === "resolved" || t.areaOnly || typeof t.lat !== "number" || typeof t.lon !== "number") continue;
      const kind = neptunKind(t);
      if (!kind) continue;
      const ts = Date.parse(t.updatedAt || t.confirmedAt || "") || nep.at || now;
      if (now - ts > FALLBACK_MAX_AGE_MS) continue;
      if (nearAny(base, kind, t.lat, t.lon)) {
        skipped.neptun++;
        continue;
      }
      const heading = t.heading ?? t.velocity?.bearingDeg ?? null;
      const x = {
        id: `n:${t.id}`,
        kind,
        subkind: null,
        amount: Number(t.count) || 1,
        title: [t.title || t.explanationShort || "", t.locality || t.region || ""].filter(Boolean).join(" · ").slice(0, 300),
        status: "active",
        heading: typeof heading === "number" ? heading : null,
        speed_kmh: t.velocity?.speedKmh ?? null,
        lat: Math.round(t.lat * 1e5) / 1e5,
        lon: Math.round(t.lon * 1e5) / 1e5,
        predicted: null,
        trail: [],
        first_seen: Date.parse(t.confirmedAt || "") || null,
        last_seen: ts,
        from_zone: null,
        from_name: null,
        to_city: null,
        to_name: null,
        source: "neptun",
        confidence: null,
        channels: [],
        reports: [],
      };
      objects.push(x);
      base.push(x);
      fbSeen.neptun.add(x.id);
      added.neptun++;
    }
  }
  mergedCache = {
    enabled: OWN_ENABLED || !!mua?.enabled,
    ok: OWN_ENABLED ? [...ch.values()].some((s) => s.ok) : !!mua?.ok,
    fetched_at: new Date(now).toISOString(),
    source_ts: mua?.source_ts || null,
    error: OWN_ENABLED ? null : mua?.error || null,
    attack: mua?.attack || null,
    objects,
    pl_violations: mua?.pl_violations || null,
    sources: { own: own.length, "mapa.ua": added["mapa.ua"], neptun: added.neptun },
    live: objects.filter((o) => o.status === "active").length,
    mapaua_quiet: muaQuiet,
    fallback_skipped_as_duplicate: skipped,
    credit: {
      own: "własny silnik Zorya (publiczne kanały Telegram)",
      fallback: [
        { name: "MAPA.UA", url: "https://mapa.ua/", on: FB_MAPAUA && !!mua?.enabled },
        { name: "NEPTUN", url: "https://neptun.in.ua/", on: FB_NEPTUN },
      ],
    },
  };
  mergedAt = now;
  return mergedCache;
}

export function recentEvents({ limit = 200, since = 0, type = null } = {}) {
  const n = Math.max(1, Math.min(EVENTS_RING, Number(limit) || 200));
  const s = Number(since) || 0;
  return ring.filter((e) => e.ts >= s && (!type || e.type === type)).slice(-n).reverse();
}

export function trackerHealth() {
  const now = Date.now();
  const snap = mergedSnapshot();
  const totalSeen = ownSeen.size + fbSeen["mapa.ua"].size + fbSeen.neptun.size;
  return {
    ok: !OWN_ENABLED || [...ch.values()].filter((s) => s.ok).length >= Math.ceil(ch.size / 2),
    own_enabled: OWN_ENABLED,
    fallback: { "mapa.ua": FB_MAPAUA, neptun: FB_NEPTUN },
    started_at: new Date(startedAt).toISOString(),
    uptime_s: Math.round((now - startedAt) / 1000),
    now: { total: snap.objects.length, ...snap.sources, skipped_as_duplicate: snap.fallback_skipped_as_duplicate },
    since_start: {
      objects_own: ownSeen.size,
      objects_mapaua: fbSeen["mapa.ua"].size,
      objects_neptun: fbSeen.neptun.size,
      own_share: totalSeen ? Math.round((ownSeen.size / totalSeen) * 1000) / 1000 : null,
    },
    parse: { ...stats },
    polling: {
      channels: ch.size,
      requests_per_min: Math.round([...ch.values()].reduce((a, s) => a + 60_000 / baseMs(s.cfg), 0) * 10) / 10,
      paused_until: pausedUntil > now ? new Date(pausedUntil).toISOString() : null,
    },
    storage: store ? { ok: true, ...store.counts() } : { ok: false },
    channels: [...ch.values()].map((s) => ({
      name: s.cfg.name,
      url: `https://t.me/s/${s.cfg.name}`,
      type: s.cfg.type,
      weight: s.cfg.weight,
      ok: s.ok,
      error: s.error,
      fetched_at: s.fetched_at ? new Date(s.fetched_at).toISOString() : null,
      last_post_at: Number.isFinite(s.last_post_ts) ? new Date(s.last_post_ts).toISOString() : null,
      posts: s.posts,
      posts_with_events: s.posts_with_events,
      events: s.events,
    })),
    unparsed_sample: unparsedSample.slice(-15),
  };
}

export const _engine = engine; // tests
