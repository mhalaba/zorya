// Offline replay: feed stored Telegram posts through the parser + engine in post-time order and
// dump an own-objects snapshot every minute (JSON lines). Used by the mapa.ua comparison harness.
// node server/uatracker/replay.mjs <uatracker.sqlite> <from_ms> <to_ms> > snaps.jsonl
import fs from "node:fs";
import { parsePost } from "./parse.mjs";
import { Engine } from "./engine.mjs";

const [dbPath, fromArg, toArg] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(new URL("./channels.json", import.meta.url), "utf8"));
const CH = new Map(cfg.channels.map((c) => [c.name, { cfg: c, lastKind: null, lastKindTs: 0 }]));
const LAST_KIND_MS = 5 * 60_000;
const from = Number(fromArg) || 0;
const to = Number(toArg) || Date.now();
// Posts from 60 min before the window warm the engine up. A .jsonl dump works without node:sqlite.
let rows;
if (dbPath.endsWith(".jsonl")) {
  rows = fs
    .readFileSync(dbPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((p) => p.ts >= from - 3600_000 && p.ts <= to)
    .sort((a, b) => a.ts - b.ts || (a.channel < b.channel ? -1 : 1) || a.id - b.id);
} else {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath, { readOnly: true });
  rows = db.prepare("SELECT channel, id, ts, text FROM posts WHERE ts >= ? AND ts <= ? ORDER BY ts, channel, id").all(from - 3600_000, to);
}
const engine = new Engine();
let nextSnap = from;
const out = [];
const snap = (t) => {
  engine.tick(t);
  out.push(JSON.stringify({ t, objects: engine.snapshot(t) }));
};
const stats = { posts: 0, events: 0, unparsed: 0 };
for (const p of rows) {
  while (p.ts > nextSnap && nextSnap <= to) {
    if (nextSnap >= from) snap(nextSnap);
    nextSnap += 60_000;
  }
  const st = CH.get(p.channel);
  if (!st) continue;
  engine.tick(p.ts);
  const lastKind = p.ts - st.lastKindTs < LAST_KIND_MS ? st.lastKind : null;
  const r = parsePost(p.text || "", { oblast: st.cfg.oblast || null, defaultKind: st.cfg.defaultKind || null, national: !!st.cfg.national, lastKind });
  const meta = { channel: p.channel, msgId: p.id, url: `https://t.me/${p.channel}/${p.id}`, ts: p.ts, weight: st.cfg.weight ?? 0.6 };
  stats.posts++;
  for (const e of r.events) {
    engine.ingest(e, meta);
    st.lastKind = e.kind;
    st.lastKindTs = p.ts;
    stats.events++;
  }
  for (const k of r.kills) engine.kill(k, meta);
  for (const c of r.clears) engine.clear(c, meta);
  for (const g of r.regional) engine.regional(g, meta);
  stats.unparsed += r.unparsed.length;
}
while (nextSnap <= to) {
  snap(nextSnap);
  nextSnap += 60_000;
}
process.stdout.write(out.join("\n") + "\n");
process.stderr.write(JSON.stringify(stats) + "\n");
