/**
 * Drone archive — persists every drone seen by Zorya for ZORYA_ARCHIVE_DAYS (default 180) days.
 *
 * What counts as a drone:
 *  - fused NEPTUN objects (state.objects) whose type is in ZORYA_ARCHIVE_TYPES (default "drone,shahed":
 *    UAV / FPV / recon / KAB and Shahed / Geran, see mapType() in ingest.mjs);
 *  - user reports (POST /api/reports) whose kind is in ZORYA_ARCHIVE_REPORT_KINDS (default "dron_samolot").
 *
 * Storage: SQLite (node:sqlite, no native build) at $ZORYA_DATA_DIR/drones.sqlite.
 *  - drone_tracks: one row per NEPTUN track id (first/last seen, first/last position, maxima, voivodeships, end).
 *  - drone_points: the first sighting of a track plus one row each time it moves >= 0.3 km or its type,
 *    title, lifecycle, location quality, confidence or confirmation count changes (all object fields + JSON).
 *  - drone_reports: one row per drone report (all fields; withdrawn reports are kept with state "withdrawn").
 * A daily prune deletes rows older than the retention window.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const here = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86_400_000;
const MOVE_KM = 0.3;
export const DATA_DIR = process.env.ZORYA_DATA_DIR || path.resolve(here, "..", "data");
export const RETENTION_DAYS = Math.max(1, Number(process.env.ZORYA_ARCHIVE_DAYS) || 180);
const csvSet = (v, d) => new Set(String(v || d).split(",").map((s) => s.trim()).filter(Boolean));
export const ARCHIVE_TYPES = csvSet(process.env.ZORYA_ARCHIVE_TYPES, "drone,shahed");
export const REPORT_KINDS = csvSet(process.env.ZORYA_ARCHIVE_REPORT_KINDS, "dron_samolot");

let db = null;
let stmts = null;
/** track_id -> snapshot of the last stored point (change detection) */
const active = new Map();

function km(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v, max = 2000) => (v == null ? null : String(v).slice(0, max));

export function openArchive(file = path.join(DATA_DIR, "drones.sqlite")) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    CREATE TABLE IF NOT EXISTS drone_tracks (
      track_id TEXT PRIMARY KEY, source TEXT NOT NULL, type TEXT, title TEXT,
      first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, ended_at INTEGER,
      first_lat REAL, first_lon REAL, last_lat REAL, last_lon REAL,
      max_confidence REAL, max_confirmations INTEGER, min_dist_pl_km REAL,
      voivodeships TEXT, points INTEGER NOT NULL DEFAULT 0, last_json TEXT);
    CREATE INDEX IF NOT EXISTS ix_tracks_last ON drone_tracks(last_seen);
    CREATE TABLE IF NOT EXISTS drone_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT, track_id TEXT NOT NULL, seen_at INTEGER NOT NULL, src_ts INTEGER,
      type TEXT, title TEXT, lat REAL, lon REAL, unc_km REAL, course REAL, speed REAL, eta_min REAL,
      confidence REAL, confirmations INTEGER, loc_quality TEXT, lifecycle TEXT,
      dist_pl_km REAL, azimuth_pl REAL, observation INTEGER, voivodeships TEXT, json TEXT);
    CREATE INDEX IF NOT EXISTS ix_points_seen ON drone_points(seen_at);
    CREATE INDEX IF NOT EXISTS ix_points_track ON drone_points(track_id, seen_at);
    CREATE TABLE IF NOT EXISTS drone_reports (
      report_id TEXT PRIMARY KEY, received_at INTEGER NOT NULL, observed_at TEXT, kind TEXT,
      lat REAL, lon REAL, rounded_m INTEGER, area_id TEXT, note TEXT, state TEXT, withdrawn_at INTEGER, json TEXT);
    CREATE INDEX IF NOT EXISTS ix_reports_recv ON drone_reports(received_at);
  `);
  stmts = {
    upsertTrack: db.prepare(`
      INSERT INTO drone_tracks (track_id, source, type, title, first_seen, last_seen, ended_at, first_lat, first_lon,
        last_lat, last_lon, max_confidence, max_confirmations, min_dist_pl_km, voivodeships, points, last_json)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(track_id) DO UPDATE SET
        type = excluded.type, title = excluded.title, last_seen = excluded.last_seen, ended_at = NULL,
        last_lat = excluded.last_lat, last_lon = excluded.last_lon,
        max_confidence = max(coalesce(max_confidence, 0), coalesce(excluded.max_confidence, 0)),
        max_confirmations = max(coalesce(max_confirmations, 0), coalesce(excluded.max_confirmations, 0)),
        min_dist_pl_km = CASE WHEN min_dist_pl_km IS NULL THEN excluded.min_dist_pl_km
                              WHEN excluded.min_dist_pl_km IS NULL THEN min_dist_pl_km
                              ELSE min(min_dist_pl_km, excluded.min_dist_pl_km) END,
        voivodeships = excluded.voivodeships,
        points = points + excluded.points,
        last_json = excluded.last_json`),
    insertPoint: db.prepare(`
      INSERT INTO drone_points (track_id, seen_at, src_ts, type, title, lat, lon, unc_km, course, speed, eta_min,
        confidence, confirmations, loc_quality, lifecycle, dist_pl_km, azimuth_pl, observation, voivodeships, json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    endTrack: db.prepare("UPDATE drone_tracks SET ended_at = ? WHERE track_id = ? AND ended_at IS NULL"),
    insertReport: db.prepare(`
      INSERT OR IGNORE INTO drone_reports (report_id, received_at, observed_at, kind, lat, lon, rounded_m, area_id,
        note, state, withdrawn_at, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', NULL, ?)`),
    withdrawReport: db.prepare("UPDATE drone_reports SET state = 'withdrawn', withdrawn_at = ? WHERE report_id = ?"),
  };
  active.clear();
  for (const r of db.prepare("SELECT track_id, last_json FROM drone_tracks WHERE ended_at IS NULL").all()) {
    let snap = null;
    try {
      snap = JSON.parse(r.last_json);
    } catch {
      /* keep null: next sighting stores a fresh point */
    }
    active.set(r.track_id, snap);
  }
  return db;
}

export function closeArchive() {
  if (db) db.close();
  db = null;
  stmts = null;
  active.clear();
}

const WATCH = ["type", "title", "lifecycle", "loc_quality", "confidence", "confirmations"];

function changed(prev, o) {
  if (!prev) return true;
  if (km(prev.lat, prev.lon, o.lat, o.lon) >= MOVE_KM) return true;
  return WATCH.some((k) => (prev[k] ?? null) !== (o[k] ?? null));
}

/** Store the drones of one fused state. Returns counts (for logs/tests). */
export function archiveState(state, now = Date.now()) {
  if (!db || !state || state.demo) return { tracks: 0, points: 0, ended: 0 };
  const objs = (state.objects || []).filter(
    (o) => o && o.id != null && ARCHIVE_TYPES.has(o.type) && num(o.lat) !== null && num(o.lon) !== null
  );
  const neptunOk = (state.sources || []).some((s) => s.id === "neptun" && s.ok && s.diode !== "dead");
  const seen = new Set();
  let points = 0;
  let ended = 0;
  db.exec("BEGIN");
  try {
    for (const o of objs) {
      const id = `neptun:${o.id}`;
      seen.add(id);
      const prev = active.get(id);
      const voiv = [...new Set([...(prev?.voiv || []), ...(o.points_contrib || []).map((c) => c?.id).filter(Boolean)])];
      const isNew = changed(prev, o);
      const { trail: _trail, ...full } = o;
      if (isNew) {
        stmts.insertPoint.run(
          id, now, Date.parse(o.ts) || null, str(o.type, 40), str(o.title, 500), o.lat, o.lon, num(o.unc_km),
          num(o.course), num(o.speed), num(o.eta_min), num(o.confidence), num(o.confirmations),
          str(o.loc_quality, 40), str(o.lifecycle, 40), num(o.dist_pl_km), num(o.azimuth_pl),
          o.observation == null ? null : o.observation ? 1 : 0, JSON.stringify(voiv), JSON.stringify(full)
        );
        points += 1;
      }
      const snap = isNew
        ? { lat: o.lat, lon: o.lon, ...Object.fromEntries(WATCH.map((k) => [k, o[k] ?? null])), voiv }
        : { ...prev, voiv };
      stmts.upsertTrack.run(
        id, "neptun", str(o.type, 40), str(o.title, 500), now, now, o.lat, o.lon, o.lat, o.lon,
        num(o.confidence), num(o.confirmations), num(o.dist_pl_km), JSON.stringify(voiv), isNew ? 1 : 0,
        JSON.stringify(snap)
      );
      active.set(id, snap);
    }
    // A track that vanished from a healthy NEPTUN feed has ended; when the feed is down we cannot tell.
    if (neptunOk) {
      for (const id of [...active.keys()]) {
        if (seen.has(id)) continue;
        ended += Number(stmts.endTrack.run(now, id).changes);
        active.delete(id);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { tracks: seen.size, points, ended };
}

export function archiveReport(reportId, body, now = Date.now()) {
  if (!db || !body || !REPORT_KINDS.has(String(body.kind))) return false;
  const loc = body.location || {};
  stmts.insertReport.run(
    String(reportId), now, str(body.observed_at, 64), str(body.kind, 40), num(loc.lat), num(loc.lon),
    num(loc.rounded_m), str(body.area_id, 64), str(body.note, 2000), JSON.stringify(body).slice(0, 32_000)
  );
  return true;
}

export function markReportWithdrawn(reportId, now = Date.now()) {
  if (!db) return false;
  return Number(stmts.withdrawReport.run(now, String(reportId)).changes) > 0;
}

export function prune(now = Date.now()) {
  if (!db) return null;
  const cutoff = now - RETENTION_DAYS * DAY;
  const out = {
    cutoff,
    points: Number(db.prepare("DELETE FROM drone_points WHERE seen_at < ?").run(cutoff).changes),
    tracks: Number(db.prepare("DELETE FROM drone_tracks WHERE last_seen < ?").run(cutoff).changes),
    reports: Number(db.prepare("DELETE FROM drone_reports WHERE received_at < ?").run(cutoff).changes),
  };
  for (const id of [...active.keys()]) {
    if (!db.prepare("SELECT 1 FROM drone_tracks WHERE track_id = ?").get(id)) active.delete(id);
  }
  return out;
}

export function startPruneTimer(log = console) {
  const run = () => {
    try {
      const r = prune();
      if (r && (r.points || r.tracks || r.reports)) log.log(`Zorya archive prune: ${JSON.stringify(r)}`);
    } catch (e) {
      log.error("Zorya archive prune", e.message || e);
    }
  };
  run();
  setInterval(run, DAY).unref();
}

const TABLES = {
  tracks: { sql: "SELECT * FROM drone_tracks WHERE last_seen >= ? AND first_seen < ? ORDER BY first_seen", drop: ["last_json"] },
  points: { sql: "SELECT * FROM drone_points WHERE seen_at >= ? AND seen_at < ? ORDER BY seen_at, id", drop: [] },
  reports: { sql: "SELECT * FROM drone_reports WHERE received_at >= ? AND received_at < ? ORDER BY received_at", drop: [] },
};

function parseTime(v, dflt) {
  if (v == null || v === "") return dflt;
  const s = String(v).trim();
  if (/^\d{10,13}$/.test(s)) return s.length === 13 ? Number(s) : Number(s) * 1000;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) throw new Error(`bad time: ${s.slice(0, 40)}`);
  return t;
}

export function queryArchive({ what = "tracks", from, to, limit } = {}, now = Date.now()) {
  if (!db) throw new Error("archive not open");
  const tb = TABLES[what];
  if (!tb) throw new Error("what must be tracks, points or reports");
  const t = parseTime(to, now);
  const f = parseTime(from, t - DAY);
  if (f >= t) throw new Error("from must be earlier than to");
  const lim = Math.min(200_000, Math.max(1, Number(limit) || 50_000));
  const rows = db.prepare(`${tb.sql} LIMIT ${lim}`).all(f, t).map((r) => {
    const o = { ...r };
    for (const k of tb.drop) delete o[k];
    return o;
  });
  return { what, from: new Date(f).toISOString(), to: new Date(t).toISOString(), retention_days: RETENTION_DAYS, count: rows.length, rows };
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

export function archiveStats() {
  if (!db) return null;
  const one = (sql) => db.prepare(sql).get();
  return {
    retention_days: RETENTION_DAYS,
    tracks: one("SELECT count(*) n, min(first_seen) first, max(last_seen) last FROM drone_tracks"),
    open_tracks: one("SELECT count(*) n FROM drone_tracks WHERE ended_at IS NULL").n,
    points: one("SELECT count(*) n FROM drone_points").n,
    reports: one("SELECT count(*) n FROM drone_reports").n,
  };
}

/** One NEPTUN track (summary + up to 2000 archived positions), for the map's drone panel. */
export function trackById(objectId, limit = 2000) {
  if (!db) throw new Error("archive not open");
  const id = `neptun:${String(objectId).slice(0, 120)}`;
  const t = db
    .prepare(
      `SELECT track_id, source, type, title, first_seen, last_seen, ended_at, max_confidence, max_confirmations,
        min_dist_pl_km, voivodeships, points FROM drone_tracks WHERE track_id = ?`
    )
    .get(id);
  if (!t) return null;
  let voivodeships = [];
  try {
    voivodeships = JSON.parse(t.voivodeships || "[]");
  } catch {
    /* keep [] */
  }
  const lim = Math.min(5000, Math.max(1, Number(limit) || 2000));
  const pts = db
    .prepare(
      `SELECT seen_at, src_ts, lat, lon, course, speed, confidence FROM drone_points
       WHERE track_id = ? ORDER BY seen_at DESC LIMIT ${lim}`
    )
    .all(id)
    .reverse();
  return { ...t, voivodeships, retention_days: RETENTION_DAYS, points_returned: pts.length, path: pts };
}
