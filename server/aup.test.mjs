// Run: node --test server/aup.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { altLabel, aupItems, aupState, itemsFromPlans, mergeAirspace } from "./aup.mjs";

const feature = (o = {}, res = {}) => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[[22.1, 51.1], [22.4, 51.1], [22.4, 51.3], [22.1, 51.3], [22.1, 51.1]]] },
  properties: {
    airspaceElementType: "TSA",
    designator: "EPTS12A",
    centroid: [{ x: 22.25, y: 51.2 }],
    popupHtml: "<b>EPTS12A</b>",
    airspaceReservations: [
      {
        startDate: "2026-10-11T06:00:00Z",
        endDate: "2026-10-11T14:00:00Z",
        lowerAltitude: "GND",
        upperAltitude: "F145",
        unit: "32 BLT",
        remarks: "",
        reservationStatus: "PLANNED",
        ...res,
      },
    ],
    ...o,
  },
});

test("altLabel: GND, A061 (×100 ft AMSL), F145", () => {
  assert.equal(altLabel("GND"), "GND");
  assert.equal(altLabel("A061"), "6100 ft AMSL");
  assert.equal(altLabel("F145"), "FL145");
  assert.equal(altLabel(""), null);
});

test("aupItems: one NOTAM-shaped item per reservation, with geometry and voivodeship", () => {
  const [it] = aupItems(feature(), "UUP");
  assert.equal(it.category, "reserved");
  assert.equal(it.map, true);
  assert.equal(it.geometry_source, "aup");
  assert.equal(it.location, "EPWW");
  assert.equal(it.lower, "GND");
  assert.equal(it.upper, "FL145");
  assert.equal(it.from, "2026-10-11T06:00:00.000Z");
  assert.equal(it.condition_label, "zaplanowana w UUP");
  assert.deepEqual(it.voivodeships, ["lubelskie"]);
  assert.deepEqual(it.bbox, [22.1, 51.1, 22.4, 51.3]);
  assert.match(it.text, /TSA EPTS12A · GND – FL145 · jednostka 32 BLT · PAŻP UUP/);
  assert.ok(!("popupHtml" in it));
});

test("aupItems: types map to categories; ATZ is list-only; bad rows skipped", () => {
  assert.equal(aupItems(feature({ airspaceElementType: "D" }))[0].category, "danger");
  assert.equal(aupItems(feature({ airspaceElementType: "R" }))[0].category, "restricted");
  assert.equal(aupItems(feature({ airspaceElementType: "ADHOC" }))[0].category, "temporary");
  const atz = aupItems(feature({ airspaceElementType: "ATZ" }))[0];
  assert.equal(atz.category, "airspace");
  assert.equal(atz.map, false);
  assert.deepEqual(aupItems(feature({}, { endDate: "2026-10-11T05:00:00Z" })), []);
  assert.deepEqual(aupItems({ properties: { designator: "X" } }), []);
});

test("itemsFromPlans: the same reservation in UUP and next AUP counts once", () => {
  const items = itemsFromPlans([
    { features: [feature()], plan: "UUP" },
    { features: [feature(), feature({}, { startDate: "2026-10-12T06:00:00Z", endDate: "2026-10-12T10:00:00Z" })], plan: "AUP na jutro" },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].condition, "UUP");
});

test("aupState and mergeAirspace: AUP first, FAA keeps its fields, errors reported", () => {
  const [it] = aupItems(feature());
  assert.equal(aupState(it, Date.parse("2026-10-11T05:00:00Z")), "upcoming");
  assert.equal(aupState(it, Date.parse("2026-10-11T07:00:00Z")), "active");
  const notam = { enabled: false, ok: false, source: "FAA", locations: ["EPWW"], fetched_at: null, error: "wyłączone", total: 0, items: [] };
  const aup = { enabled: true, ok: true, source: "PAŻP AUP/UUP", fetched_at: "2026-10-11T07:00:00Z", error: null, items: [it] };
  const m = mergeAirspace(notam, aup);
  assert.equal(m.enabled, true);
  assert.equal(m.ok, true);
  assert.equal(m.items.length, 1);
  assert.equal(m.source, "PAŻP AUP/UUP");
  assert.equal(m.error, null);
  assert.deepEqual(m.locations, ["EPWW"]);
  assert.equal(m.aup.count, 1);
  const both = mergeAirspace({ ...notam, enabled: true, error: "HTTP 403" }, { ...aup, ok: false, error: "timeout" });
  assert.equal(both.ok, false);
  assert.match(both.error, /AUP: timeout; NOTAM: HTTP 403/);
});
