// Run: node --test server/notam.test.mjs   (synthetic ICAO messages in the FAA list format; no network)
import test from "node:test";
import assert from "node:assert/strict";
import { classifyQcode, geometryFromText, itemsFromRows, notamState, parseIcaoNotam, toNotamItem } from "./notam.mjs";

const POLY = [
  "A2015/26 NOTAMN",
  "Q) EPWW/QRTCA/IV/BO/W/000/040/5114N02338E030",
  "A) EPWW B) 2610010600 C) 2612312359",
  "D) DAILY 0600-1800",
  "E) TEMPORARY RESTRICTED AREA EP R129 ACT WI AREA: 512000N0233000E - 512000N0240000E -",
  "510500N0240000E - 510500N0233000E - 512000N0233000E. FLIGHTS OF UAS PROHIBITED.",
  "F) GND G) FL040",
  "CREATED: 30 Sep 2026 10:00:00 SOURCE: EUECYIYN",
].join("\n");

test("parseIcaoNotam reads every item", () => {
  const p = parseIcaoNotam(POLY);
  assert.equal(p.id, "A2015/26");
  assert.equal(p.type, "N");
  assert.equal(p.qcode, "QRTCA");
  assert.equal(p.location, "EPWW");
  assert.equal(p.from, Date.UTC(2026, 9, 1, 6, 0));
  assert.equal(p.to, Date.UTC(2026, 11, 31, 23, 59));
  assert.equal(p.schedule, "DAILY 0600-1800");
  assert.match(p.text, /^TEMPORARY RESTRICTED AREA EP R129/);
  assert.equal(p.lower, "GND");
  assert.equal(p.upper, "FL040"); // FAA's "CREATED: …" trailer is not part of G)
  assert.deepEqual(p.center, [23 + 38 / 60, 51 + 14 / 60]);
  assert.equal(p.radius_nm, 30);
});

test("polygon from the E) text, voivodeship and map flag", () => {
  const it = toNotamItem({ icaoMessage: POLY });
  assert.equal(it.category, "temporary");
  assert.equal(it.condition_label, "aktywowana");
  assert.equal(it.geometry_source, "text");
  assert.equal(it.geometry.type, "Polygon");
  assert.equal(it.geometry.coordinates[0].length, 5);
  assert.deepEqual(it.geometry.coordinates[0][0], [23.5, 51.33333]);
  assert.ok(it.voivodeships.includes("lubelskie"));
  assert.equal(it.map, true);
  assert.equal(notamState(it, Date.UTC(2026, 9, 11)), "active");
  assert.equal(notamState(it, Date.UTC(2026, 8, 11)), "upcoming");
});

test("circle from RADIUS, Q-line fallback, permanent, cancellations", () => {
  const circleMsg = "A0101/26 NOTAMN Q) EPWW/QWULW/IV/BO/W/000/010/5015N01950E005 A) EPWW B) 2610100800 C) 2610101600 E) UAS FLIGHTS WI RADIUS 2KM CENTRED ON 501500N0195000E. F) GND G) 300M AGL";
  const c = toNotamItem({ icaoMessage: circleMsg });
  assert.equal(c.category, "uas");
  assert.equal(c.geometry_source, "circle");
  assert.deepEqual(c.voivodeships, ["malopolskie"]);

  const q = toNotamItem({ icaoMessage: "A0102/26 NOTAMN Q) EPWW/QWMLW/IV/BO/W/000/100/5410N01800E010 A) EPWW B) 2610100800 C) 2610101600 E) MISSILE FIRING WILL TAKE PLACE." });
  assert.equal(q.category, "firing");
  assert.equal(q.geometry_source, "qline");
  assert.equal(q.lower, "GND");
  assert.equal(q.upper, "FL100");

  const big = toNotamItem({ icaoMessage: "A0103/26 NOTAMN Q) EPWW/QAFXX/IV/NBO/E/000/999/5200N01900E999 A) EPWW B) 2610100800 C) PERM E) FIR EPWW INFO." });
  assert.equal(big.geometry, null); // whole-FIR radius is not drawn
  assert.equal(big.permanent, true);
  assert.equal(big.to, null);
  assert.equal(big.map, false);
  assert.deepEqual(big.voivodeships, []); // centre of the FIR is not "about" łódzkie

  const off = toNotamItem({ icaoMessage: "A0104/26 NOTAMR A0100/26 Q) EPWW/QRDCD/IV/BO/W/000/050/5200N02200E005 A) EPWW B) 2610100800 C) 2610101600 E) EP D12 DEACTIVATED." });
  assert.equal(off.replaces, "A0100/26");
  assert.equal(off.map, false); // deactivated: listed, not drawn

  assert.equal(toNotamItem({ icaoMessage: "A0105/26 NOTAMC A0100/26 Q) EPWW/QRDXX/IV/BO/W/000/050/5200N02200E005 A) EPWW B) 2610100800 E) CNL" }), null);
});

test("multiple areas in one NOTAM become a MultiPolygon", () => {
  const g = geometryFromText(
    "AREA 1: 520000N0220000E - 520000N0221000E - 515000N0221000E - 520000N0220000E. AREA 2 SITUATED FURTHER NORTH ALONG THE BORDER: 530000N0230000E - 530000N0231000E - 525000N0231000E."
  );
  assert.equal(g.geometry.type, "MultiPolygon");
  assert.equal(g.geometry.coordinates.length, 2);
  assert.deepEqual(g.geometry.coordinates[1][0].at(-1), [23, 53]); // second ring closed automatically
});

test("Q-code classes and de-duplication of ended NOTAMs", () => {
  assert.equal(classifyQcode("QRPCA").category, "prohibited");
  assert.equal(classifyQcode("QWELW").category, "exercise");
  assert.equal(classifyQcode("QRZZZ").category, "restricted");
  assert.equal(classifyQcode("QOBCE").category, "other");
  const rows = [
    { icaoMessage: POLY },
    { icaoMessage: POLY },
    { icaoMessage: "A0001/26 NOTAMN Q) EPWW/QWELW/IV/BO/W/000/050/5200N02200E005 A) EPWW B) 2601010800 C) 2601011600 E) OLD EXERCISE." },
  ];
  rows.push({ icaoMessage: "A0002/26 NOTAMN Q) EPWW/QOBCE/IV/M/A/000/005/5200N02100E001 A) EPWW B) 2610010800 C) 2612311600 E) CRANE ERECTED." });
  const stats = {};
  const items = itemsFromRows(rows, Date.UTC(2026, 9, 11), stats);
  assert.equal(items.length, 1); // duplicate merged, ended dropped, obstacle filtered out
  assert.equal(stats.skipped, 1);
  assert.equal(classifyQcode("QGWXX").category, "gnss");
});
