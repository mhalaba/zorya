#!/usr/bin/env python3
"""Compare Zorya's own Ukraine objects with what mapa.ua's map shows (snapshots from zcollect.py).
mapa.ua 'visible' = status active, last update (max trail ts / last_seen) <= FRESH min before its ts, no FPV.
Usage: zanalyze.py [since_unix] [until_unix] [--misses]"""
import json, gzip, glob, math, sys, statistics, collections, sqlite3, re, time
FRESH = 15 * 60
R = {"drone": 60, "missile": 120, "bomb": 50}
def grp(k):
    k = k or ""
    return "missile" if k.startswith("missile") else "bomb" if k == "bomb" else "drone"
def dist(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))
def angdiff(a, b):
    d = abs((a - b) % 360); return min(d, 360 - d)
def brg(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lo2 - lo1) * math.cos(la2); x = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(lo2 - lo1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360
def mapa_visible(snap):
    m = snap.get("mapa") or {}
    ts = m.get("ts") or snap["t"]
    out = []
    for o in m.get("objects") or []:
        if o.get("status") != "active" or o.get("kind") == "drone_fpv": continue
        tr = o.get("trail") or []
        last = max([tr[-1][2] if tr else 0, o.get("last_seen") or 0])
        if ts - last > FRESH: continue
        pos = (o["predicted_lat"], o["predicted_lon"]) if o.get("predicted_lat") else (o["lat"], o["lon"])
        h = brg((tr[-2][1], tr[-2][0]), (tr[-1][1], tr[-1][0])) if len(tr) >= 2 else o.get("heading")
        out.append({"id": o["id"], "oid": o.get("original_id") or str(o["id"]).split("_u")[0], "g": grp(o["kind"]), "kind": o["kind"], "pos": pos, "h": h,
                    "title": o.get("title") or "", "to": o.get("to_city"), "from": o.get("from_zone"), "age": ts - last})
    return out
def own_active(snap):
    out = []
    for o in (snap.get("own") or {}).get("objects") or []:
        if o.get("status") != "active": continue
        out.append({"id": o["id"], "g": grp(o["kind"]), "kind": o["kind"], "pos": (o["lat"], o["lon"]), "h": o.get("heading"), "n": o.get("amount") or 1,
                    "to": o.get("to_name"), "rep": ((o.get("reports") or [{}])[-1].get("text") or "")[:100]})
    return out
def compare(snap):
    mv, ov = mapa_visible(snap), own_active(snap)
    # recall: each mapa unit matched to the nearest compatible own object within R (own capacity = amount, then reused)
    hits, errs, herrs, missed = 0, [], [], []
    for m in mv:
        c = [(dist(m["pos"], o["pos"]), o) for o in ov if o["g"] == m["g"]]
        c = [x for x in c if x[0] <= R[m["g"]]]
        if c:
            d, o = min(c, key=lambda x: x[0]); hits += 1; errs.append(d)
            if m["h"] is not None and o["h"] is not None: herrs.append(angdiff(m["h"], o["h"]))
        else: missed.append(m)
    # precision: own object with any compatible mapa object (any status/age <= 60 min) within R
    allm = []
    ts = (snap.get("mapa") or {}).get("ts") or snap["t"]
    for o in (snap.get("mapa") or {}).get("objects") or []:
        tr = o.get("trail") or []; last = max([tr[-1][2] if tr else 0, o.get("last_seen") or 0])
        if ts - last <= 3600: allm.append((grp(o["kind"]), (o.get("predicted_lat") or o["lat"], o.get("predicted_lon") or o["lon"])))
    unmatched = [o for o in ov if not any(g == o["g"] and dist(p, o["pos"]) <= R[g] for g, p in allm)]
    return dict(n_mapa=len(mv), n_own=len(ov), own_units=sum(o["n"] for o in ov), hits=hits, errs=errs, herrs=herrs, missed=missed, unmatched=unmatched)
def obl(title):
    m = re.search(r"(?:у|в|над|на)\s+(\S+щин\S*|\S+ччин\S*|\S+ій області|Києві|Київщині|Одесі|Харкові)", title or "")
    return m.group(1) if m else (title or "?")[:30]
def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    since = int(a[0]) if a else 0; until = int(a[1]) if len(a) > 1 else 1 << 40
    files = sorted(f for f in glob.glob("/root/zcompare/snaps/*.json.gz") if since <= int(f.split("/")[-1].split(".")[0]) <= until)
    tot = collections.Counter(); errs, herrs = [], []; missobl = collections.Counter(); missed_ids = {}; unm = {}
    for f in files:
        s = json.load(gzip.open(f, "rt"))
        if "mapa" not in s or "own" not in s: continue
        r = compare(s)
        tot["snaps"] += 1; tot["mapa"] += r["n_mapa"]; tot["hits"] += r["hits"]; tot["own"] += r["n_own"]; tot["own_unmatched"] += len(r["unmatched"])
        errs += r["errs"]; herrs += r["herrs"]
        for m in r["missed"]:
            missobl[obl(m["title"])] += 1; missed_ids[m["oid"]] = (s["t"], m)
        for o in r["unmatched"]: unm[o["id"]] = (s["t"], o)
    if not tot["snaps"]: print("no snapshots"); return
    q = lambda xs, p: (sorted(xs)[int(p * (len(xs) - 1))] if xs else None)
    print(f"snapshots {tot['snaps']}  ({time.strftime('%H:%M', time.localtime(int(files[0].split('/')[-1][:10])))}–{time.strftime('%H:%M', time.localtime(int(files[-1].split('/')[-1][:10])))} local)")
    print(f"mapa.ua visible units/snap {tot['mapa']/tot['snaps']:.1f}   own active/snap {tot['own']/tot['snaps']:.1f}")
    print(f"RECALL   {tot['hits']/max(1,tot['mapa']):.1%}  (mapa.ua units with own counterpart)")
    print(f"PRECISION {1-tot['own_unmatched']/max(1,tot['own']):.1%}  (own objects with a mapa.ua object nearby, last 60 min)")
    print(f"position error km  median {q(errs,.5) and round(q(errs,.5),1)}  p80 {q(errs,.8) and round(q(errs,.8),1)}   heading error deg median {q(herrs,.5) and round(q(herrs,.5))}")
    print("misses by region (unit-snapshots):", ", ".join(f"{k} {v}" for k, v in missobl.most_common(14)))
    if "--misses" in sys.argv:
        print("\n== distinct missed mapa.ua groups (last seen) ==")
        seen = set()
        for oid, (t, m) in sorted(missed_ids.items(), key=lambda x: -x[1][0]):
            if oid in seen: continue
            seen.add(oid)
            print(f"{time.strftime('%H:%M', time.localtime(t))} {m['kind']:16} {m['pos'][0]:.2f},{m['pos'][1]:.2f} age {m['age']//60}m  '{m['title']}' to={m['to']} from={m['from']}")
        print("\n== own objects without mapa.ua counterpart ==")
        for i, (t, o) in sorted(unm.items(), key=lambda x: -x[1][0]):
            print(f"{time.strftime('%H:%M', time.localtime(t))} {o['kind']:16} {o['pos'][0]:.2f},{o['pos'][1]:.2f} n={o['n']} to={o['to']} | {o['rep']}")
if __name__ == "__main__": main()
