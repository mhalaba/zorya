// Run: node --test server/admin.test.mjs   (uses public/geo/pl-admin.topojson and public/geo/gminy/*.topojson)
import test from "node:test";
import assert from "node:assert/strict";
import * as A from "./admin.mjs";
import { tauronItem } from "./operators.mjs";
import { meteoItem } from "./imgw.mjs";
import { toLocalItems } from "./local.mjs";

test("boundaries loaded: 2479 gminy, 380 powiaty, anchors inside their gmina", () => {
  assert.equal(A.allGminy().length, 2479);
  assert.equal(A.allPowiaty().length, 380);
  for (const g of A.allGminy()) assert.equal(A.gminaAt(g.anchor[1], g.anchor[0])?.id, g.id, g.name);
});

test("point → gmina / powiat", () => {
  const cases = [
    [51.2465, 22.5684, "0663011", "Lublin"],
    [52.2297, 21.0122, "1465011", "Warszawa"],
    [49.29, 19.95, "1217011", "Zakopane"],
    [50.3249, 18.7857, "2478011", "Zabrze"],
  ];
  for (const [lat, lon, id, name] of cases) {
    const g = A.gminaAt(lat, lon);
    assert.equal(g?.id, id);
    assert.equal(g?.name, name);
  }
  assert.equal(A.gminaAt(50.45, 30.52), null); // Kyiv
  assert.equal(A.powiatAt(49.29, 19.95).label, "powiat tatrzański");
  assert.deepEqual(A.powiatNeighbors("1217"), ["1211"]); // tatrzański borders only nowotarski in Poland
});

test("TERYT codes of any length", () => {
  assert.deepEqual(A.unitsFromTeryt(["1465011"]), { gminy: ["1465011"], powiaty: ["1465"] });
  assert.deepEqual(A.unitsFromTeryt(["061907"]).gminy, ["0619072"]); // 6 digits, no type digit
  assert.deepEqual(A.unitsFromTeryt(["2466", "06", "9999"]), { gminy: [], powiaty: ["2466"] });
});

test("names in text, scoped to voivodeships, ambiguous names skipped", () => {
  assert.deepEqual(A.unitsFromText("Wyłączenie w gminie Wola Uhruska, powiat włodawski", ["lubelskie"]), { gminy: ["0619072"], powiaty: ["0619"] });
  assert.deepEqual(A.unitsFromText("na terenie powiatu zamojskiego i hrubieszowskiego", ["lubelskie"]).powiaty, ["0604", "0620"]);
  assert.deepEqual(A.unitsFromText("gmina Osiek", []).gminy, []); // four gminy of that name
  assert.equal(A.unitsFromText("gmina Osiek", ["malopolskie"]).gminy.length, 1);
  assert.deepEqual(A.unitsFromText("dobra woda, gmina dobra", ["zachodniopomorskie"]).gminy, []); // lower case: not a name
  const sw = A.unitsFromText("miasto Świdnica", ["dolnoslaskie"]).gminy.map((id) => A.gminaById(id).kind);
  assert.deepEqual(sw, ["miejska"]);
});

test("areas: a zone covering gminy without any of its vertices inside them still finds them", () => {
  const box = { type: "Polygon", coordinates: [[[22.3, 51.1], [22.8, 51.1], [22.8, 51.4], [22.3, 51.4], [22.3, 51.1]]] };
  const u = A.unitsForGeometry(box);
  assert.ok(u.gminy.includes("0663011"), "Lublin lies inside the box");
  assert.ok(u.powiaty.includes("0663"));
});

test("sources carry gmina / powiat precision", () => {
  const now = Date.parse("2026-10-11T10:00:00Z");
  const t = tauronItem(
    { OutageId: 5, TypeId: 1, StartDate: "2026-10-11T12:00:00Z", EndDate: "2026-10-11T16:00:00Z", Message: "Zabrze: ul. Wolności", Center: { lat: 50.3249, lng: 18.7857 } },
    now
  );
  assert.deepEqual([t.gminy, t.powiaty, t.point], [["2478011"], ["2478"], [18.7857, 50.3249]]);
  const m = meteoItem(
    { id: "1", nazwa_zdarzenia: "Silny wiatr", stopien: "1", obowiazuje_od: "2026-10-11 08:00:00", obowiazuje_do: "2026-10-12 08:00:00", opublikowano: "2026-10-11 07:00:00", teryt: ["2466", "2402"] },
    now
  );
  assert.deepEqual([m.powiaty, m.gminy], [["2402", "2466"], []]);
  const [r] = toLocalItems([{ id: "x", title: "Awaria wodociągu", text: "brak wody w gminie Wola Uhruska", ts: now, voivodeships: ["lubelskie"] }], now);
  assert.deepEqual(r.gminy, ["0619072"]);
});

test("powiat levels: nearer powiaty score higher, band keeps them within a step of the voivodeship", async () => {
  const { buildState } = await import("./fusion.mjs");
  const now = Date.now();
  const obj = (id, lat, lon) => ({
    id, type: "shahed", lat, lon, unc_km: 10, course: 270, speed: 180, eta_min: null, confidence: 0.84,
    confirmations: 3, loc_quality: "track", lifecycle: "tracked", count: 2, ts: now - 60_000, title: "x",
  });
  const st = buildState(now, { objects: [obj("a", 51.0, 24.3)], ua_alerts: [] }, null);
  const lv = new Map(st.powiaty.list.map(([id, l, p]) => [id, { l, p }]));
  const pts = (id) => lv.get(id)?.p ?? 0;
  assert.ok(pts("0618") >= pts("0614"), "powiat at the border ≥ powiat far to the west (lubelskie)");
  const rank = { info: 0, watch: 1, priority: 2 };
  for (const [id, l] of st.powiaty.list) {
    const v = st.voivodeships.find((x) => x.id === A.powiatById(id).woj);
    assert.ok(rank[l === "p" ? "priority" : "watch"] <= rank[v.level] + 1, `${id} above band`);
  }
  // Quiet state: nothing listed.
  assert.deepEqual(buildState(now, {}, null).powiaty.list, []);
});

test("review fixes: capitalised keywords, hyphenated powiaty, partial overlaps", () => {
  assert.ok(A.unitsFromText("Gmina Hrubieszów informuje o przerwie", ["lubelskie"]).gminy.length >= 1);
  assert.deepEqual(A.unitsFromText("Miasto Hrubieszów: brak wody", ["lubelskie"]).gminy, ["0604011"]);
  const k = A.unitsFromText("w powiecie kędzierzyńsko-kozielskim", ["opolskie"]).powiaty;
  assert.equal(k.length, 1);
  assert.equal(A.powiatById(k[0]).name, "kędzierzyńsko-kozielski");
  assert.deepEqual(A.unitsFromText("w powiecie strzelecko-drezdeneckim", ["lubuskie", "opolskie"]).powiaty.map((id) => A.powiatById(id).name), ["strzelecko-drezdenecki"]);
  // Every gmina with a sampled point inside the rectangle must be found.
  const box = { type: "Polygon", coordinates: [[[20, 52], [21, 52], [21, 52.5], [20, 52.5], [20, 52]]] };
  const found = new Set(A.unitsForGeometry(box).gminy);
  for (let x = 20.005; x < 21; x += 0.02) for (let y = 52.005; y < 52.5; y += 0.02) {
    const g = A.gminaAt(y, x);
    if (g) assert.ok(found.has(g.id), `${g.name} missed`);
  }
});
