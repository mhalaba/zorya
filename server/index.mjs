import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";
import { buildState, emptyHistory, stampHistory, VOIV } from "./fusion.mjs";
import { ingestLive, emptyInput, INGEST_EVERY_MS } from "./ingest.mjs";
import { notifyFromState, pushPublicKey, upsertPushSub, removePushSub } from "./push.mjs";
import { addReport, horizonFromFusion, loadFixtures, statusFromFusion, withdrawReport } from "./horizon.mjs";
import { mapaUaSnapshot, startMapaUa } from "./mapaua.mjs";
import { netOutagesSnapshot, startNetOutages } from "./netoutage.mjs";
import { gnssSnapshot, startGnss } from "./gnss.mjs";
import { archiveReport, archiveState, archiveStats, markReportWithdrawn, openArchive, queryArchive, startPruneTimer, toCsv, trackById } from "./archive.mjs";
import { localStore, startLocalFeeds } from "./local.mjs";
import { notamSnapshot, startNotams } from "./notam.mjs";
import { airspaceSnapshot, startAirspace } from "./airspace.mjs";
import { aupSnapshot, mergeAirspace, startAup } from "./aup.mjs";
import { startOperators } from "./operators.mjs";
import { startImgw } from "./imgw.mjs";
import { rateLimit, safeEqual, securityHeaders } from "./security.mjs";
import { search } from "./search.mjs";
import { ADMIN_READY, gminaAt, gminaById, gminaInfo, powiatById, powiatInfo } from "./admin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const isProd = process.env.NODE_ENV === "production";
/** Optional shared secret for the archive, on top of the LAN-only rule. */
const ARCHIVE_TOKEN = String(process.env.ZORYA_ARCHIVE_TOKEN || "").trim();
const WS_MAX_CLIENTS = Math.max(100, Number(process.env.ZORYA_WS_MAX_CLIENTS) || 5000);

const app = express();
app.disable("x-powered-by");
app.set("etag", false);
app.use(securityHeaders({ isProd }));
// Generous backstop only: a mobile carrier's CGNAT puts hundreds of real users behind one address,
// and during an alarm they all poll at once. Floods are Cloudflare's job; writes have tight limits below.
app.use("/api", rateLimit({ windowMs: 60_000, max: 3000, name: "api" }));
app.use(express.json({ limit: "32kb" }));

const writeLimit = rateLimit({ windowMs: 10 * 60_000, max: 20, name: "zapis" });
const pushLimit = rateLimit({ windowMs: 10 * 60_000, max: 120, name: "push" });
// Address look-ups reach GUGiK / OpenStreetMap: a person searches a few times, a scraper many.
const geocodeLimit = rateLimit({ windowMs: 60_000, max: 20, name: "wyszukiwanie" });

let state = buildState(Date.now(), emptyInput(), null);
let historyBundle = emptyHistory(12);

/**
 * JSON bodies that many clients poll: serialised once per change, served with an ETag so an unchanged
 * answer costs a 304 instead of re-sending (and re-stringifying) the same megabyte.
 */
const bodies = new Map();
function cachedJson(key, value) {
  const hit = bodies.get(key);
  if (hit && hit.value === value) return hit;
  const body = JSON.stringify(value);
  const entry = { value, body, etag: `"${crypto.createHash("sha1").update(body).digest("base64url")}"` };
  bodies.set(key, entry);
  return entry;
}
function sendCached(req, res, key, value, cacheControl = "no-cache") {
  const { body, etag } = cachedJson(key, value);
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", cacheControl);
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.type("application/json").send(body);
}

// Drone archive (180 days, SQLite in ZORYA_DATA_DIR). A broken archive must never take the site down.
let archiveOn = false;
try {
  openArchive();
  startPruneTimer();
  archiveOn = true;
} catch (err) {
  console.error("Zorya archive disabled", err.message || err);
}

localStore.load();

/** Archive endpoints are LAN-only: anything via the Cloudflare tunnel / zorya.website is refused. */
function archiveAllowed(req) {
  const h = req.headers;
  if (h["cf-connecting-ip"] || h["cf-ray"] || h["cdn-loop"] || h["x-forwarded-for"] || h["x-forwarded-host"]) return false;
  const host = String(h.host || "").toLowerCase().replace(/:\d+$/, "");
  if (!host || host.endsWith("zorya.website") || host.endsWith("halaba.online")) return false;
  const ip = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  if (!/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip)) return false;
  if (!ARCHIVE_TOKEN) return true;
  const auth = String(h.authorization || "");
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : String(req.query.token || "");
  return safeEqual(given, ARCHIVE_TOKEN);
}

function archiveGuard(req, res) {
  res.removeHeader("Access-Control-Allow-Origin");
  res.setHeader("Cache-Control", "no-store");
  if (!archiveAllowed(req)) {
    res.status(403).json({ error: "archive is LAN-only" });
    return false;
  }
  if (!archiveOn) {
    res.status(503).json({ error: "archive disabled" });
    return false;
  }
  return true;
}

app.get("/api/archive/stats", (req, res) => {
  if (!archiveGuard(req, res)) return;
  res.json(archiveStats());
});

app.get(["/api/archive", "/api/archive.csv"], (req, res) => {
  if (!archiveGuard(req, res)) return;
  try {
    const out = queryArchive(req.query);
    if (req.path.endsWith(".csv")) {
      const stamp = out.to.slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="zorya-drones-${out.what}-${stamp}.csv"`);
      return res.send(toCsv(out.rows));
    }
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message || "archive" });
  }
});

/** Archived route of one drone. Public only for objects on the live map now; older tracks stay LAN-only like /api/archive. */
app.get("/api/track/:id", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.params.id || "").slice(0, 120);
  const live = (state.objects || []).some((o) => String(o.id) === id);
  if (!live && !archiveAllowed(req)) return res.status(403).json({ error: "only live objects are public" });
  if (!archiveOn) return res.status(503).json({ error: "archive disabled" });
  try {
    const t = trackById(id);
    if (!t) return res.status(404).json({ error: "track not in archive" });
    res.json(t);
  } catch (err) {
    console.error("Zorya track", err.message || err);
    res.status(500).json({ error: "archive" });
  }
});

/** MAPA.UA missiles / KAB / drones over Ukraine, trimmed (see server/mapaua.mjs). */
app.get("/api/ua-threats", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=15");
  res.json(mapaUaSnapshot());
});

/** Internet outages (IODA, optional Cloudflare Radar) for PL and neighbours (see server/netoutage.mjs). */
app.get("/api/net-outages", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=120");
  res.json(netOutagesSnapshot());
});

/** GNSS interference hexes: gpsjam.org daily + live ADS-B NIC/NACp aggregation (see server/gnss.mjs). */
app.get("/api/gnss", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(gnssSnapshot());
});

/** Water / power / gas outages and exercises per voivodeship (RSO + optional feeds). Informational. */
app.get("/api/local-alerts", (req, res) => {
  sendCached(req, res, "local", localStore.snapshot(), "public, max-age=30");
});

/**
 * Airspace layer: PAŻP AUP/UUP reservations (TSA/TRA/D/R/ad hoc, today and tomorrow) and FAA NOTAMs (FIR EPWW,
 * if enabled and reachable) in one "notam" list with zone geometry, plus the optional permanent P/R/D/TSA/TRA structure.
 */
let airspaceBody = null;
let airspaceKey = null;
app.get("/api/airspace", (req, res) => {
  const notam = notamSnapshot();
  const aup = aupSnapshot();
  const zones = airspaceSnapshot();
  if (!airspaceBody || airspaceKey.notam !== notam || airspaceKey.aup !== aup || airspaceKey.zones !== zones) {
    airspaceKey = { notam, aup, zones };
    airspaceBody = { notam: mergeAirspace(notam, aup), zones, generated_at: new Date().toISOString() };
  }
  sendCached(req, res, "airspace", airspaceBody, "public, max-age=60");
});

/**
 * Administrative unit of a point or code: ?lat=&lon= (map click, search result, "my location") or ?gmina=TERYT.
 * Answers gmina + powiat + voivodeship, or 404 outside Poland. Pure lookup — no personal data is kept.
 */
app.get("/api/place", (req, res) => {
  if (!ADMIN_READY) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "brak granic gmin" });
  }
  res.setHeader("Cache-Control", "public, max-age=86400");
  const code = String(req.query.gmina || "").replace(/\D/g, "").slice(0, 7);
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const g = code ? gminaById(code) : Number.isFinite(lat) && Number.isFinite(lon) ? gminaAt(lat, lon) : null;
  if (!g) return res.status(404).json({ error: "poza Polską lub nieznana gmina" });
  const info = gminaInfo(g);
  res.json({ gmina: info, powiat: powiatInfo(powiatById(g.pow)), voivodeship: g.woj });
});

/** Search: ?q=…&mode=quick (names, while typing) | full (with address geocoding, on Enter). */
app.get("/api/search", (req, res, next) => {
  const full = req.query.mode === "full";
  const run = () =>
    search(typeof req.query.q === "string" ? req.query.q : "", full ? "full" : "quick")
      .then((out) => {
        res.setHeader("Cache-Control", full ? "private, max-age=300" : "public, max-age=3600");
        res.json(out);
      })
      .catch(next);
  return full ? geocodeLimit(req, res, run) : run();
});

app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, name: "zorya", live: !state.demo, generated_at: state.generated_at });
});

app.get("/api/state", (req, res) => {
  sendCached(req, res, "state", state);
});

app.get("/api/history/bundle", (req, res) => {
  const asked = Math.round(Number(req.query.hours));
  const hours = Number.isFinite(asked) ? Math.min(historyBundle.hours, Math.max(1, asked)) : historyBundle.hours;
  res.json(sliceHistory(historyBundle, hours));
});

/** The last `hours` of the rolling bundle, with t0 and sample indices re-based. */
function sliceHistory(bundle, hours) {
  const n = Math.min(bundle.n, Math.round((hours * 3600) / bundle.step_s));
  const skip = bundle.n - n;
  if (!skip) return bundle;
  return {
    ...bundle,
    hours,
    n,
    t0: new Date(new Date(bundle.t0).getTime() + skip * bundle.step_s * 1000).toISOString(),
    max_pl: bundle.max_pl.slice(skip),
    voivodeships: Object.fromEntries(Object.entries(bundle.voivodeships).map(([id, arr]) => [id, arr.slice(skip)])),
    objects: bundle.objects.map((o) => ({
      ...o,
      samples: o.samples.filter((s) => s.t >= skip).map((s) => ({ ...s, t: s.t - skip })),
    })),
  };
}

app.get("/api/meta", (_req, res) => {
  res.json({ voivodeships: VOIV, demo: false, attribution: "https://neptun.in.ua/", pushKey: pushPublicKey() });
});

app.get("/api/push/key", (_req, res) => {
  res.json({ publicKey: pushPublicKey() });
});

app.post("/api/push/subscribe", pushLimit, (req, res) => {
  try {
    res.json(upsertPushSub(req.body || {}));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || "subscribe" });
  }
});

app.post("/api/push/unsubscribe", pushLimit, (req, res) => {
  removePushSub(req.body?.endpoint);
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => {
  if (req.query.fixture) {
    const fx = loadFixtures();
    return res.json({ ...fx.status, sources: fx.sources, sample: true });
  }
  res.json(statusFromFusion(state));
});

app.get("/api/horizon", (req, res) => {
  if (req.query.fixture) {
    const fx = loadFixtures();
    const area = fx.areas.find((a) => a.id === req.query.area) || fx.areas[0];
    const status = (fx.status.area_status || []).find((s) => s.area.id === area.id) || fx.status.area_status[0];
    return res.json({ status, events: fx.events, signals: fx.signals.filter((s) => !s.event_id), sources: fx.sources, sample: true });
  }
  res.json(horizonFromFusion(state, typeof req.query.area === "string" ? req.query.area : null));
});

app.get("/api/events/:id", (req, res) => {
  const fx = loadFixtures();
  const fromFx = fx.events.find((e) => e.id === req.params.id);
  if (fromFx) return res.json(fromFx);
  const live = horizonFromFusion(state, null).events.find((e) => e.id === req.params.id);
  if (live) return res.json(live);
  res.status(404).json({ error: "brak" });
});

app.get("/api/sources/:id", (req, res) => {
  const fx = loadFixtures();
  const source = fx.sources.find((s) => s.id === req.params.id);
  const items = fx.signals.filter((s) => s.source === req.params.id).slice(-20);
  if (source) return res.json({ source, items });
  res.status(404).json({ error: "brak" });
});

app.get("/api/areas", (_req, res) => {
  res.json({ areas: loadFixtures().areas, voivodeships: VOIV });
});

app.post("/api/reports", writeLimit, (req, res) => {
  try {
    const out = addReport(req.body || {});
    try {
      archiveReport(out.id, out.report);
    } catch (err) {
      console.error("Zorya archive report", err.message || err);
    }
    res.json({ id: out.id, withdraw_until: out.withdraw_until });
  } catch (err) {
    res.status(400).json({ error: err.message || "report" });
  }
});

app.delete("/api/reports/:id", writeLimit, (req, res) => {
  const id = String(req.params.id || "").slice(0, 64);
  const ok = withdrawReport(id);
  if (ok) {
    try {
      markReportWithdrawn(id);
    } catch {
      /* archive is best effort */
    }
  }
  res.status(ok ? 200 : 404).json({ ok });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "brak" }));

if (isProd) {
  const dist = path.join(root, "dist");
  if (fs.existsSync(dist)) {
    // Prerendered public pages (scripts/prerender.mjs): route-specific <head> + static text for crawlers.
    const seoDir = path.join(dist, "seo");
    let seoRoutes = {};
    try {
      seoRoutes = JSON.parse(fs.readFileSync(path.join(seoDir, "routes.json"), "utf8"));
    } catch {
      console.error("Zorya: no dist/seo/routes.json, serving plain index.html");
    }
    const sendHtml = (res, file, status = 200) => {
      res.status(status);
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(file);
    };
    const pageFor = (p) => {
      const clean = p.length > 1 ? p.replace(/\/+$/, "") : p;
      if (clean === "/about") return seoRoutes["/en/about"];
      if (clean === "/app" || clean.startsWith("/app/")) return seoRoutes["/app/mapa"];
      return seoRoutes[clean];
    };
    app.get(["/about", "/about/"], (_req, res) => res.redirect(301, "/en/about"));
    app.get(["/", "/index.html"], (_req, res, next) => {
      const f = seoRoutes["/"];
      if (!f) return next();
      sendHtml(res, path.join(seoDir, f));
    });
    app.use(
      express.static(dist, {
        index: false,
        setHeaders(res, file) {
          const rel = path.relative(dist, file).split(path.sep).join("/");
          if (rel.startsWith("assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          else if (rel.startsWith("fonts/") || rel.startsWith("icons/") || rel.startsWith("geo/") || rel.endsWith(".png") || rel === "favicon.ico")
            res.setHeader("Cache-Control", "public, max-age=604800");
          else if (rel === "sw.js" || rel.endsWith(".html") || rel.endsWith(".webmanifest")) res.setHeader("Cache-Control", "no-cache");
          else if (rel === "robots.txt" || rel === "sitemap.xml") res.setHeader("Cache-Control", "public, max-age=3600");
          if (rel.startsWith("seo/")) res.setHeader("X-Robots-Tag", "noindex");
        },
      })
    );
    const bron = path.join(dist, "bron", "index.html");
    app.get(["/bron", "/bron/"], (_req, res, next) => (fs.existsSync(bron) ? sendHtml(res, bron) : next()));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
      const f = pageFor(req.path);
      if (f) {
        // Sub-routes of the app (e.g. /app/sygnaly) share the map page but are not separate pages.
        if (req.path.startsWith("/app") && req.path !== "/app/mapa") res.setHeader("X-Robots-Tag", "noindex, follow");
        return sendHtml(res, path.join(seoDir, f));
      }
      // Unknown path: real 404 (no soft-404), still the SPA so links keep working.
      res.setHeader("X-Robots-Tag", "noindex");
      if (seoRoutes["/404"]) return sendHtml(res, path.join(seoDir, seoRoutes["/404"]), 404);
      sendHtml(res, path.join(dist, "index.html"), 404);
    });
  }
}

// Malformed JSON, oversized bodies and anything unexpected: a short JSON error, never a stack trace.
app.use((err, _req, res, _next) => {
  const status = Number(err?.status || err?.statusCode) || 500;
  if (status >= 500) console.error("Zorya http", err?.message || err);
  if (res.headersSent) return;
  res.status(status).json({ error: status === 413 ? "za duże zapytanie" : status < 500 ? "złe zapytanie" : "błąd serwera" });
});

const server = http.createServer(app);
server.headersTimeout = 20_000;
server.requestTimeout = 30_000;
// Clients never send anything over the socket: tiny frames only, no compression bombs.
const wss = new WebSocketServer({ server, path: "/api/ws", maxPayload: 1024, perMessageDeflate: false });

function broadcast(data) {
  for (const c of wss.clients) {
    // A client that cannot keep up (several MB queued) is dropped rather than buffered without bound.
    if (c.readyState === 1 && c.bufferedAmount < 8 * 1024 * 1024) c.send(data);
  }
}

/** The WS frame reuses the cached /api/state body: one JSON.stringify of the state per cycle. */
const frameFor = (st) => `{"type":"state","state":${cachedJson("state", st).body}}`;
let stateFrame = frameFor(state);

wss.on("connection", (socket) => {
  if (wss.clients.size > WS_MAX_CLIENTS) {
    socket.close(1013, "busy");
    return;
  }
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });
  socket.on("message", () => undefined);
  socket.on("error", () => socket.terminate());
  socket.send(stateFrame);
});

// Heartbeat: half-open sockets (phone slept, NAT dropped) are terminated instead of piling up.
const heartbeat = setInterval(() => {
  for (const c of wss.clients) {
    if (c.isAlive === false) {
      c.terminate();
      continue;
    }
    c.isAlive = false;
    c.ping();
  }
}, 30_000);
heartbeat.unref();

let cycling = false;
async function cycle() {
  if (cycling) return;
  cycling = true;
  try {
    const live = await ingestLive();
    const now = Date.now();
    state = buildState(now, live.input, live.sources);
    stampHistory(historyBundle, state);
    if (live.local) localStore.merge(live.local, now);
    localStore.setStatus("rso", { name: "RSO (komunikaty.tvp.pl)", ...live.localStatus, records: live.local?.length ?? 0 });
    localStore.save();
    if (archiveOn) {
      try {
        archiveState(state);
      } catch (err) {
        console.error("Zorya archive", err.message || err);
      }
    }
    stateFrame = frameFor(state);
    broadcast(stateFrame);
    void notifyFromState(state).catch((err) => console.error("Zorya push", err.message || err));
  } catch (err) {
    console.error("Zorya ingest", err.message || err);
  } finally {
    cycling = false;
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Zorya fusion live http://${HOST}:${PORT}`);
  void cycle();
  setInterval(() => void cycle(), INGEST_EVERY_MS);
  startMapaUa();
  startNetOutages();
  startGnss();
  startNotams();
  startAup();
  startAirspace();
  startLocalFeeds();
  startOperators(localStore);
  startImgw(localStore);
});

function shutdown() {
  localStore.save();
  server.close();
  for (const c of wss.clients) c.terminate();
  setTimeout(() => process.exit(0), 500).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
