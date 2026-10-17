import json, sys, time, math
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from zreplaycmp import mapa_at, interp
COL = {"drone_piston": "#FBBF24", "drone_jet": "#F97316", "missile_cruise": "#A78BFA", "missile_ballistic": "#5EEAD4", "bomb": "#EF4444"}
geo = json.load(open("/workspace/zorya/public/geo/ua-oblasts.geojson"))
objs = json.load(open("mapa687.json"))["objects"]
reps = {k: {json.loads(l)["t"] // 1000: json.loads(l) for l in open(f)} for k, f in (("before", "rbase.jsonl"), ("after", "rnew.jsonl"))}
def base(ax, title):
    for f in geo["features"]:
        g = f["geometry"]; polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for p in polys:
            xs, ys = zip(*p[0]); ax.fill(xs, ys, color="#1d222b", ec="#3a4250", lw=0.5)
    ax.set_xlim(22, 40.5); ax.set_ylim(44.2, 52.6); ax.set_aspect(1 / math.cos(math.radians(48.5)))
    ax.set_facecolor("#0b0f16"); ax.set_xticks([]); ax.set_yticks([]); ax.set_title(title, color="w", fontsize=10)
def arrow(ax, lon, lat, h, c, alpha=1, s=70):
    ax.scatter([lon], [lat], marker=(3, 0, -h), s=s, c=c, edgecolors="#070b12", linewidths=0.8, alpha=alpha, zorder=5)
times = [int(x) for x in sys.argv[1:]]
fig, axs = plt.subplots(len(times), 3, figsize=(18, 5.6 * len(times)), facecolor="#0b0f16")
if len(times) == 1: axs = [axs]
for row, t in zip(axs, times):
    T = time.strftime("%H:%M", time.localtime(t))
    mv = mapa_at(objs, t)
    base(row[0], f"mapa.ua {T} (Warsaw) — {len(mv)} units on map")
    for o in objs:
        tr = [p for p in (o.get("trail") or []) if p[2] <= t]
        if any(m["oid"] == str(o.get("original_id") or o["id"]).split("_u")[0] for m in mv) and len(tr) > 1:
            row[0].plot([p[0] for p in tr], [p[1] for p in tr], color=COL.get(o["kind"], "#ccc"), lw=1, alpha=0.6)
    for m in mv: arrow(row[0], m["pos"][1], m["pos"][0], m["h"] or 0, COL.get(m["kind"], "#ccc"))
    for col, k in ((1, "before"), (2, "after")):
        s = reps[k].get(t) or reps[k][min(reps[k], key=lambda x: abs(x - t))]
        act = [o for o in s["objects"] if o["status"] == "active"]
        base(row[col], f"Zorya own engine — {k} ({len(act)} active objects, {sum(o.get('amount') or 1 for o in act)} units)")
        for o in s["objects"]:
            dead = o["status"] != "active"; c = "#8a909c" if dead else COL.get(o["kind"], "#ccc")
            tr = o.get("trail") or []
            if len(tr) > 1: row[col].plot([p[0] for p in tr], [p[1] for p in tr], color=c, lw=1, alpha=0.35 if dead else 0.7)
            arrow(row[col], o["lon"], o["lat"], o.get("heading") or 0, c, 0.5 if dead else 1, 40 if dead else 70)
            if not dead and (o.get("amount") or 1) > 1: row[col].text(o["lon"] + 0.15, o["lat"] + 0.1, f"×{o['amount']}", color="w", fontsize=7)
        # mapa.ua units as hollow rings for reference
        row[col].scatter([m["pos"][1] for m in mv], [m["pos"][0] for m in mv], s=110, facecolors="none", edgecolors="#ffffff", linewidths=0.6, alpha=0.45, zorder=4)
fig.text(0.5, 0.005, "Replay of stored Telegram posts through Zorya's parser+engine vs mapa.ua attack #687 reconstructed at the same minute. White rings in Zorya panels = mapa.ua unit positions. Colours: amber Shahed, orange jet, violet cruise, teal ballistic, red KAB, grey lost.", color="#aaa", ha="center", fontsize=9)
plt.tight_layout(rect=(0, 0.02, 1, 1))
plt.savefig(sys.argv[0].replace("plot.py", "") + "compare.png", dpi=90, facecolor=fig.get_facecolor())
print("saved")
