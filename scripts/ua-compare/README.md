# Zorya vs mapa.ua comparison harness

Measures how close Zorya's own Ukraine tracker is to what mapa.ua's map shows.

## mapa.ua (studied 17.10.2026, public API + inline frontend JS)
- `GET /api/v1/current` → `{attack, objects, raw_count, ts}`; `GET /api/v1/attack_replay?attack_id=N` (same shape, whole attack);
  `GET /api/v1/attacks` (id, started_at, ended_at, status, totals, official_* counts). Times are **unix seconds**.
- Object: `id` (per unit, `objId_uN`), `original_id`, `group_id`, `unit_index`, `kind` (drone_piston / drone_jet / drone_fpv /
  missile_cruise / missile_ballistic / bomb), `subkind` (e.g. banderol, kalibr, x101), `amount`, `title` (AI summary of the post),
  `status` (active / lost / eliminated / hit_target), `heading`, `lat/lon`, `predicted_lat/lon`, `speed_kmh` (piston 165, jet 450,
  cruise 800, bomb 750), `first_seen/last_seen`, `from_zone` (bryansk, belgorod, crimea, mozyr, tot_zap, black_sea_w, kursk…),
  `to_city` (slug), `trail` [[lon, lat, ts]] dead-reckoned every ~130 s from the launch zone, `channel` (always null).
- Rendering (OpenLayers): per-subkind SVG silhouettes (Shahed delta amber #fbbf24, jet swept-wing orange #f97316, banderol
  magenta #d946ef, cruise violet #a78bfa, ballistic teal #5eead4, KAB red #ef4444, FPV olive), rotated by the heading of the last
  trail segment, drawn at the predicted position; lost/eliminated = grey #52555f, smaller. Trail = smoothed polyline in fading
  bands + direction arrows; dashed line from the last trail point to the predicted position.
- Live fading ("1h window"): age = now − last update (max(last trail ts, last_seen)); ≤5 min full brightness, then linear to 0.1
  at 60 min; ≥60 min hidden. Dead markers start at 0.35–0.45 and fade to 0 over the hour.
- Header counts: drones / missiles / bombs over the objects of `/current` (official Air Force counts when present);
  the badge says "НЕБО ЧИСТЕ" only when `/current` has **no attack** at all (`attack == null`).

## Tools
- `zcollect.py` (on Sietch, `/root/zcompare`): every 60 s saves mapa.ua `/current` + Zorya own/merged snapshots.
- `zanalyze.py [since] [until] [--misses]`: live recall / precision / position + heading error from those snapshots.
- `server/uatracker/replay.mjs <posts.sqlite|posts.jsonl> <from_ms> <to_ms>`: replays stored posts through parser + engine,
  one own snapshot per minute; `zreplaycmp.py replay.jsonl mapa_attack.json [--misses]` compares it with the mapa.ua attack
  reconstructed at the same minutes (units active, updated ≤15 min, trail interpolated). `plot.py t1 t2 …` draws side-by-side maps.
- Matching: same weapon group, nearest own object within 60 km (drones) / 120 km (missiles) / 50 km (KAB).
