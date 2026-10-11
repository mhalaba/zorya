// Run: node --test server/operators.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { placeOf, pgeItem, pgeItems, tauronItem, tauronItems, tauronUrl } from "./operators.mjs";
import { createLocalStore } from "./local.mjs";
import { warsawToUtc } from "./util.mjs";

const REF = warsawToUtc(2026, 10, 11, 9, 0); // 11.10.2026 09:00 Warsaw
const H = 3600_000;

const tauronRow = (o = {}) => ({
  OutageId: 123456,
  Modified: "2026-10-10T12:00:00Z",
  StartDate: "2026-10-12T06:00:00Z",
  EndDate: "2026-10-12T12:00:00Z",
  Message: "Zabrze: Wolności 1-15, Roosevelta 2",
  TypeId: 1,
  IsActive: true,
  Coordinates: [{ lat: 50.3249, lng: 18.7857 }],
  Center: { lat: 50.3249, lng: 18.7857 },
  ...o,
});

test("placeOf: place before the colon, otherwise a short head", () => {
  assert.equal(placeOf("Jastrzębie-Zdrój: Norwida 1-5"), "Jastrzębie-Zdrój");
  assert.equal(placeOf("Miejscowość Knurów: Szpitalna"), "Knurów");
  assert.ok(placeOf("x ".repeat(80)).length <= 48);
});

test("tauronItem: planned outage in Zabrze → śląskie, power, source window", () => {
  const it = tauronItem(tauronRow(), REF);
  assert.equal(it.id, "tauron-123456");
  assert.equal(it.source, "tauron");
  assert.deepEqual(it.categories, ["power"]);
  assert.equal(it.kind, "planned");
  assert.equal(it.window, "source");
  assert.deepEqual(it.voivodeships, ["slaskie"]);
  assert.equal(it.title, "Planowane wyłączenie prądu: Zabrze");
  assert.equal(it.starts_at, "2026-10-12T06:00:00.000Z");
  assert.equal(tauronItem(tauronRow({ TypeId: 2 }), REF).kind, "outage");
});

test("tauronItem: ended, inactive and beyond the horizon are dropped", () => {
  assert.equal(tauronItem(tauronRow({ EndDate: "2026-10-11T06:00:00Z" }), REF), null);
  assert.equal(tauronItem(tauronRow({ IsActive: false }), REF), null);
  assert.equal(tauronItem(tauronRow({ StartDate: "2026-10-20T06:00:00Z", EndDate: "2026-10-20T12:00:00Z" }), REF), null);
  assert.equal(tauronItems([tauronRow(), null, {}], REF).length, 1);
  // The same OutageId listed twice (two areas) → one item.
  const two = tauronItems([tauronRow(), tauronRow({ Center: { lat: 50.06, lng: 19.94 }, Coordinates: [] })], REF);
  assert.equal(two.length, 1);
  assert.deepEqual(two[0].voivodeships, ["slaskie", "malopolskie"]);
});

test("tauronItem: long messages are clipped to keep the payload small", () => {
  const it = tauronItem(tauronRow({ Message: `Gliwice: ${"Ulica 1, ".repeat(200)}` }), REF);
  assert.ok(it.summary.length <= 300);
});

test("tauronUrl: from now to the horizon", () => {
  const u = new URL(tauronUrl(REF));
  assert.equal(u.searchParams.get("fromDate"), new Date(REF).toISOString());
  assert.ok(Date.parse(u.searchParams.get("toDate")) > REF);
});

const pgeRow = (o = {}) => ({
  id: 77,
  uuid: "a-b-c",
  type: 2,
  description: "Lublin: ul. Nadbystrzycka 10-20",
  regionName: "Lublin",
  startAt: "2026-10-12 08:00:00",
  stopAt: "2026-10-12 14:00:00",
  revoked: false,
  addresses: [{ teryt: { voivodeshipCode: "06", cityName: "Lublin" } }],
  coordinates: [{ latitude: 51.24, longitude: 22.57 }],
  updatedAt: "2026-10-10 10:00:00",
  ...o,
});

test("pgeItem: Warsaw local times, TERYT voivodeship, planned/outage", () => {
  const it = pgeItem(pgeRow(), REF);
  assert.equal(it.id, "pge-a-b-c");
  assert.equal(it.kind, "planned");
  assert.deepEqual(it.voivodeships, ["lubelskie"]);
  assert.equal(it.starts_at, new Date(warsawToUtc(2026, 10, 12, 8, 0)).toISOString());
  assert.equal(it.title, "Planowane wyłączenie prądu: Lublin");
  assert.match(it.source_name, /RE Lublin/);
  assert.equal(pgeItem(pgeRow({ type: 1 }), REF).kind, "outage");
});

test("pgeItem: revoked dropped; no addresses → voivodeship from coordinates", () => {
  assert.equal(pgeItem(pgeRow({ revoked: true }), REF), null);
  assert.deepEqual(pgeItem(pgeRow({ addresses: null }), REF).voivodeships, ["lubelskie"]);
});

test("pgeItem: several date ranges → the next live one, with a count of the rest", () => {
  const it = pgeItem(
    pgeRow({
      dateRanges: [
        { startAt: "2026-10-10 08:00:00", stopAt: "2026-10-10 12:00:00" },
        { startAt: "2026-10-12 08:00:00", stopAt: "2026-10-12 12:00:00" },
        { startAt: "2026-10-13 08:00:00", stopAt: "2026-10-13 12:00:00" },
      ],
    }),
    REF
  );
  assert.equal(it.starts_at, new Date(warsawToUtc(2026, 10, 12, 8, 0)).toISOString());
  assert.match(it.summary, /\+1 kolejne terminy/);
  assert.equal(pgeItems({ content: [pgeRow()] }, REF).length, 1);
});

test("store.replaceSource: withdrawn operator items disappear, other sources stay", () => {
  const store = createLocalStore({ file: null });
  const a = tauronItem(tauronRow(), REF);
  const b = tauronItem(tauronRow({ OutageId: 9 }), REF);
  const p = pgeItem(pgeRow(), REF);
  store.replaceSource("tauron", [a, b], REF);
  store.replaceSource("pge", [p], REF);
  assert.equal(store.snapshot(REF).items.length, 3);
  store.replaceSource("tauron", [a], REF + H);
  const ids = store.snapshot(REF + 2 * H).items.map((x) => x.id).sort();
  assert.deepEqual(ids, ["pge-a-b-c", "tauron-123456"]);
});
