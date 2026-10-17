#!/usr/bin/env python3
"""Compare a replay (own snapshots, JSON lines) with mapa.ua's attack reconstructed at the same minutes.
mapa.ua at t: units whose trail started <= t, last update >= t-15min, not yet terminal at t; position = trail interpolated at t
(or extrapolated along the last segment up to the last update + predicted). Usage: zreplaycmp.py replay.jsonl mapa_attack.json [--misses]"""
import json, sys, math, collections, time, bisect
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from zanalyze import dist, angdiff, brg, grp, R, obl
FRESH = 15 * 60
def interp(tr, t):
    if not tr or t < tr[0][2]: return None
    if t >= tr[-1][2]: return (tr[-1][1], tr[-1][0]), (brg((tr[-2][1], tr[-2][0]), (tr[-1][1], tr[-1][0])) if len(tr) > 1 else None)
    i = bisect.bisect_right([p[2] for p in tr], t)
    a, b = tr[i - 1], tr[i]
    f = (t - a[2]) / max(1, b[2] - a[2])
    return (a[1] + (b[1] - a[1]) * f, a[0] + (b[0] - a[0]) * f), brg((a[1], a[0]), (b[1], b[0]))
def mapa_at(objs, t):
    out = []
    for o in objs:
        if o.get("kind") == "drone_fpv": continue
        tr = o.get("trail") or []
        if not tr: continue
        last = max(tr[-1][2], o.get("last_seen") or 0)
        if t < tr[0][2] or t - min(last, t) > FRESH: continue
        if o.get("status") != "active" and t > (o.get("last_seen") or last): continue
        r = interp(tr, t)
        if not r: continue
        out.append({"oid": str(o.get("original_id") or o["id"]).split("_u")[0], "g": grp(o["kind"]), "kind": o["kind"], "pos": r[0], "h": r[1], "title": o.get("title") or "", "to": o.get("to_city")})
    return out
def main():
    rep = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
    m = json.load(open(sys.argv[2])); objs = m.get("objects") or []
    tot = collections.Counter(); errs, herrs = [], []; missobl = collections.Counter(); missed = {}; unm = {}
    for s in rep:
        t = s["t"] // 1000
        mv = mapa_at(objs, t)
        ov = [{"g": grp(o["kind"]), "kind": o["kind"], "pos": (o["lat"], o["lon"]), "h": o.get("heading"), "id": o["id"], "n": o.get("amount") or 1, "to": o.get("to_name"),
               "rep": ((o.get("reports") or [{}])[-1].get("text") or "")[:110]} for o in s["objects"] if o["status"] == "active"]
        tot["snaps"] += 1; tot["mapa"] += len(mv); tot["own"] += len(ov)
        for x in mv:
            c = [(dist(x["pos"], o["pos"]), o) for o in ov if o["g"] == x["g"] and dist(x["pos"], o["pos"]) <= R[x["g"]]]
            if c:
                d, o = min(c, key=lambda y: y[0]); tot["hits"] += 1; errs.append(d)
                if x["h"] is not None and o["h"] is not None: herrs.append(angdiff(x["h"], o["h"]))
            else:
                missobl[obl(x["title"])] += 1; missed.setdefault(x["oid"], []).append((t, x))
        allm = mapa_at(objs, t) + [{"g": grp(o["kind"]), "pos": interp(o.get("trail") or [], min(t, (o.get("trail") or [[0, 0, 0]])[-1][2]))[0]} for o in objs if (o.get("trail") or []) and o["trail"][0][2] <= t <= max(o["trail"][-1][2], o.get("last_seen") or 0) + 3600]
        for o in ov:
            if not any(y["g"] == o["g"] and dist(y["pos"], o["pos"]) <= R[o["g"]] for y in allm):
                tot["own_unmatched"] += 1; unm[o["id"]] = (t, o)
    q = lambda xs, p: round(sorted(xs)[int(p * (len(xs) - 1))], 1) if xs else None
    T = lambda t: time.strftime("%H:%M", time.localtime(t))
    print(f"replay minutes {tot['snaps']} ({T(rep[0]['t']//1000)}–{T(rep[-1]['t']//1000)} local)  mapa.ua units/min {tot['mapa']/tot['snaps']:.1f}  own active/min {tot['own']/tot['snaps']:.1f}")
    print(f"RECALL {tot['hits']/max(1,tot['mapa']):.1%}   PRECISION {1-tot['own_unmatched']/max(1,tot['own']):.1%}   pos err km median {q(errs,.5)} p80 {q(errs,.8)}   heading err median {q(herrs,.5)}°")
    print("misses by region:", ", ".join(f"{k} {v}" for k, v in missobl.most_common(16)))
    if "--misses" in sys.argv:
        print("\n== missed mapa.ua groups: minutes missed, span, title, to ==")
        for oid, xs in sorted(missed.items(), key=lambda kv: -len(kv[1]))[:60]:
            x = xs[-1][1]
            print(f"{len(xs):3}m {T(xs[0][0])}-{T(xs[-1][0])} {x['kind']:15} {x['pos'][0]:.2f},{x['pos'][1]:.2f} '{x['title']}' to={x['to']}")
        print("\n== own objects w/o mapa.ua counterpart ==")
        for i, (t, o) in sorted(unm.items(), key=lambda kv: kv[1][0])[:50]:
            print(f"{T(t)} {o['kind']:15} {o['pos'][0]:.2f},{o['pos'][1]:.2f} n={o['n']} to={o['to']} | {o['rep']}")
if __name__ == "__main__": main()
