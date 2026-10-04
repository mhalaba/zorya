// Run: node --test server/archive.test.mjs   (uses a temp DB, never the real archive)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as A from "./archive.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zorya-arch-"));
const file = path.join(tmp, "drones.sqlite");
const src = [{ id: "neptun", ok: true, diode: "ok" }];
const obj = (o) => ({
  id: "trk_1", type: "drone", title: "FPV · X", lat: 50, lon: 30, unc_km: 12, course: null, speed: null, eta_min: null,
  confidence: 0.55, confirmations: 2, loc_quality: "region", lifecycle: "tracked", ts: "2026-10-04T10:00:00Z",
  dist_pl_km: 500, azimuth_pl: 90, observation: true, points_contrib: [{ id: "lubelskie", points: 0.2 }], trail: [], ...o,
});

test("tracks, point dedupe, end, reports, prune, persistence", () => {
  A.openArchive(file);
  const t0 = Date.parse("2026-10-04T10:00:00Z");
  let r = A.archiveState({ demo: false, sources: src, objects: [obj(), obj({ id: "c1", type: "cruise" })] }, t0);
  assert.deepEqual(r, { tracks: 1, points: 1, ended: 0 }); // cruise missile is not a drone
  r = A.archiveState({ demo: false, sources: src, objects: [obj()] }, t0 + 60_000);
  assert.equal(r.points, 0); // same place, same fields -> no new point
  r = A.archiveState({ demo: false, sources: src, objects: [obj({ lat: 50.01 })] }, t0 + 120_000);
  assert.equal(r.points, 1); // moved ~1.1 km
  r = A.archiveState({ demo: false, sources: [{ id: "neptun", ok: false, diode: "dead" }], objects: [] }, t0 + 180_000);
  assert.equal(r.ended, 0); // feed down: do not end tracks
  r = A.archiveState({ demo: false, sources: src, objects: [] }, t0 + 240_000);
  assert.equal(r.ended, 1);
  assert.equal(A.archiveState({ demo: true, sources: src, objects: [obj({ id: "demo" })] }, t0).tracks, 0);

  assert.equal(A.archiveReport("r-1", { kind: "dron_samolot", observed_at: "x", location: { lat: 50.1, lon: 22.1, rounded_m: 500 }, note: "n" }, t0), true);
  assert.equal(A.archiveReport("r-2", { kind: "syrena" }, t0), false);
  assert.equal(A.markReportWithdrawn("r-1", t0 + 1000), true);

  const tr = A.queryArchive({ what: "tracks", from: t0 - 1, to: t0 + 1e6 });
  assert.equal(tr.count, 1);
  assert.equal(tr.rows[0].points, 2);
  assert.equal(tr.rows[0].ended_at, t0 + 240_000);
  assert.equal(A.queryArchive({ what: "points", from: t0 - 1, to: t0 + 1e6 }).count, 2);
  assert.equal(A.queryArchive({ what: "reports", from: t0 - 1, to: t0 + 1e6 }).rows[0].state, "withdrawn");
  assert.match(A.toCsv(tr.rows), /^track_id,source,type/);

  // persistence across reopen (container restart)
  A.closeArchive();
  A.openArchive(file);
  assert.equal(A.archiveStats().tracks.n, 1);

  // retention: a record older than RETENTION_DAYS is pruned, a fresh one stays
  const old = t0 - (A.RETENTION_DAYS + 1) * 86_400_000;
  A.archiveState({ demo: false, sources: src, objects: [obj({ id: "old" })] }, old);
  A.archiveReport("r-old", { kind: "dron_samolot" }, old);
  const p = A.prune(t0);
  assert.deepEqual([p.tracks, p.points, p.reports], [1, 1, 1]);
  assert.equal(A.archiveStats().tracks.n, 1);
  A.closeArchive();
  fs.rmSync(tmp, { recursive: true, force: true });
});
