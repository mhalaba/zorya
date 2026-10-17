#!/usr/bin/env python3
# Every 60 s: snapshot mapa.ua /api/v1/current and Zorya's own objects for the comparison harness.
import json, time, urllib.request, os, gzip
OUT = "/root/zcompare/snaps"
os.makedirs(OUT, exist_ok=True)
def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "zorya-compare/1 (+https://zorya.website)"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())
while True:
    t = int(time.time())
    snap = {"t": t}
    for k, u in (("mapa", "https://mapa.ua/api/v1/current"), ("own", "http://127.0.0.1:8787/api/ua-threats?source=own"), ("merged", "http://127.0.0.1:8787/api/ua-threats")):
        try: snap[k] = get(u)
        except Exception as e: snap[k + "_err"] = str(e)
    with gzip.open(f"{OUT}/{t}.json.gz", "wt") as f: json.dump(snap, f)
    time.sleep(max(1, 60 - (time.time() - t)))
