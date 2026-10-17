/** SQLite (node:sqlite) for the UA tracker: seen posts, parsed events, live objects (restart-safe). */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const KEEP_DAYS = Math.max(1, Number(process.env.UA_TRACKER_KEEP_DAYS) || 14);

export function openStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    CREATE TABLE IF NOT EXISTS posts (channel TEXT NOT NULL, id INTEGER NOT NULL, ts INTEGER, text TEXT, n_events INTEGER DEFAULT 0, PRIMARY KEY (channel, id));
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, channel TEXT, msg_id INTEGER, type TEXT, kind TEXT, count INTEGER,
      oblast TEXT, place TEXT, lat REAL, lon REAL, target TEXT, tlat REAL, tlon REAL, from_zone TEXT, object_id TEXT, line TEXT);
    CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
    CREATE TABLE IF NOT EXISTS objects (id TEXT PRIMARY KEY, last_seen INTEGER, json TEXT);
  `);
  const q = {
    lastIds: db.prepare("SELECT channel, MAX(id) AS id FROM posts GROUP BY channel"),
    addPost: db.prepare("INSERT OR IGNORE INTO posts (channel, id, ts, text, n_events) VALUES (?, ?, ?, ?, ?)"),
    addEvent: db.prepare(
      "INSERT INTO events (ts, channel, msg_id, type, kind, count, oblast, place, lat, lon, target, tlat, tlon, from_zone, object_id, line) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ),
    recent: db.prepare("SELECT * FROM events WHERE ts >= ? ORDER BY seq DESC LIMIT ?"),
    upsertObj: db.prepare("INSERT INTO objects (id, last_seen, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen, json=excluded.json"),
    delObj: db.prepare("DELETE FROM objects WHERE id = ?"),
    liveObjs: db.prepare("SELECT json FROM objects WHERE last_seen >= ?"),
    counts: db.prepare("SELECT (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM events) AS events, (SELECT COUNT(*) FROM events WHERE ts >= ?) AS events_24h"),
    prunePosts: db.prepare("DELETE FROM posts WHERE ts < ? AND id NOT IN (SELECT MAX(id) FROM posts GROUP BY channel)"),
    pruneEvents: db.prepare("DELETE FROM events WHERE ts < ?"),
    pruneObjs: db.prepare("DELETE FROM objects WHERE last_seen < ?"),
  };
  const s = (v) => (v == null ? null : v);
  return {
    lastIds() {
      return new Map(q.lastIds.all().map((r) => [r.channel, Number(r.id)]));
    },
    addPost(channel, m, nEvents) {
      q.addPost.run(channel, m.id, Number.isFinite(m.ts) ? m.ts : Date.now(), String(m.text || "").slice(0, 4000), nEvents);
    },
    addEvent(e) {
      q.addEvent.run(
        e.ts, e.channel, e.msg_id, e.type, s(e.kind), s(e.count), s(e.oblast), s(e.place), s(e.lat), s(e.lon), s(e.target), s(e.tlat), s(e.tlon), s(e.from_zone), s(e.object_id), s(e.line)
      );
    },
    recentEvents(sinceMs, limit) {
      return q.recent.all(sinceMs, limit);
    },
    saveObjects(changes) {
      db.exec("BEGIN");
      try {
        for (const { id, obj } of changes) {
          if (obj) q.upsertObj.run(id, obj.last_seen, JSON.stringify(obj));
          else q.delObj.run(id);
        }
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    liveObjects(sinceMs) {
      return q.liveObjs.all(sinceMs).map((r) => JSON.parse(r.json));
    },
    counts() {
      return q.counts.get(Date.now() - 86400_000);
    },
    prune() {
      const cut = Date.now() - KEEP_DAYS * 86400_000;
      q.prunePosts.run(cut);
      q.pruneEvents.run(cut);
      q.pruneObjs.run(Date.now() - 2 * 3600_000);
    },
  };
}
