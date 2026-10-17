# Per-minute recall / precision / position + heading error vs mapa.ua from the collector snapshots (run on Sietch).
# Usage: python3 zpermin.py <since_unix>
import sys, glob, gzip, json, time, statistics
sys.path.insert(0, "/root/zcompare"); import zanalyze as Z
since = int(sys.argv[1])
files = sorted(f for f in glob.glob("/root/zcompare/snaps/*.json.gz") if int(f.split("/")[-1][:10]) >= since)
print("time  mapa own units hits recall prec  med_km  med_hdg  unmatched")
for f in files:
    s = json.load(gzip.open(f, "rt"))
    if "mapa" not in s or "own" not in s: continue
    r = Z.compare(s)
    rec = r["hits"]/r["n_mapa"] if r["n_mapa"] else float("nan")
    pr = 1-len(r["unmatched"])/r["n_own"] if r["n_own"] else float("nan")
    md = statistics.median(r["errs"]) if r["errs"] else float("nan")
    mh = statistics.median(r["herrs"]) if r["herrs"] else float("nan")
    print(f"{time.strftime('%H:%M', time.localtime(s['t']))} {r['n_mapa']:4} {r['n_own']:3} {r['own_units']:5} {r['hits']:4} {rec:6.0%} {pr:5.0%} {md:7.1f} {mh:7.0f}  " + ",".join(o["id"] for o in r["unmatched"]))
