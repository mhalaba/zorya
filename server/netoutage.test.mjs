import test from "node:test";
import assert from "node:assert/strict";
import { buildItems, compactSignals, filterCf, locate, severity } from "./netoutage.mjs";

test("locate maps our countries and regions, ignores others", () => {
  assert.equal(locate({ type: "country", code: "PL" }).id, "cc:PL");
  assert.equal(locate({ type: "region", code: "4378" }).id, "ua:kherson");
  assert.equal(locate({ type: "region", code: "3295" }).id, "pl:slaskie");
  assert.equal(locate({ type: "country", code: "IQ" }), null);
  assert.equal(locate(null), null);
});

test("severity is log-scaled", () => {
  assert.equal(severity(0), 0);
  assert.equal(severity(500), 1);
  assert.equal(severity(20_000), 2);
  assert.equal(severity(5e7), 3);
});

test("buildItems merges summaries and alerts, marks recent critical as active", () => {
  const now = 1_800_000_000;
  const items = buildItems(
    [
      { scores: { "bgp.median": 20000, overall: 20000 }, event_cnt: 1, entity: { type: "region", code: "4362" } },
      { scores: { overall: 9e6 }, event_cnt: 3, entity: { type: "country", code: "IQ" } },
    ],
    [
      { datasource: "bgp", level: "critical", time: now - 600, value: 500, historyValue: 600, entity: { type: "region", code: "4378" } },
      { datasource: "bgp", level: "normal", time: now, entity: { type: "region", code: "4362" } },
      { datasource: "ping-slash24", level: "critical", time: now - 10 * 3600, entity: { type: "region", code: "4362" } },
    ],
    now
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "ua:kherson");
  assert.equal(items[0].active, true);
  assert.equal(items[0].alerts[0].expected, 600);
  const z = items[1];
  assert.equal(z.id, "ua:zakarpattia");
  assert.equal(z.active, false);
  assert.equal(z.severity, 2);
  assert.deepEqual(z.sources.sort(), ["bgp", "ping-slash24"]);
});

test("compactSignals keeps known sources and normalises", () => {
  const s = compactSignals({ data: [[
    { datasource: "bgp", from: 10, step: 300, values: [50, 100, null] },
    { datasource: "gtr-sarima", values: [1] },
  ]] });
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].values, [0.5, 1, null]);
  assert.equal(s[0].from, 10_000);
});

test("filterCf keeps annotations for our countries", () => {
  const out = filterCf([
    { id: "a", locations: ["UA", "US"], outage: { outageCause: "POWER_OUTAGE" }, startDate: "2026-10-01" },
    { id: "b", locations: [{ code: "FR" }] },
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].countries, ["UA"]);
  assert.equal(out[0].cause, "POWER_OUTAGE");
});
