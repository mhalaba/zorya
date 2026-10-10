import test from "node:test";
import assert from "node:assert/strict";
import { trimObjects } from "./mapaua.mjs";

test("trimObjects keeps fresh objects, drops >60 min, trims fields", () => {
  const now = 1_800_000_000;
  const trail = Array.from({ length: 60 }, (_, i) => [30 + i * 0.01, 50, now - 600 + i]);
  const out = trimObjects(
    [
      { id: 1, kind: "missile_cruise", subkind: "missile_cruise", status: "active", heading: 250, lat: 50.123456, lon: 25.5,
        predicted_lat: 50.1, predicted_lon: 25.4, speed_kmh: 800, first_seen: now - 900, last_seen: now - 60,
        from_zone: "bryansk", to_city: "lutsk", trail, ai_id: "x", channel: "secret" },
      { id: 2, kind: "bomb", status: "lost", lat: 48, lon: 35, last_seen: now - 3601 },
      { id: 3, kind: "weird", lat: 48, lon: 35, last_seen: now, predicted_lat: 48, predicted_lon: 35 },
    ],
    now
  );
  assert.equal(out.length, 2);
  const m = out[0];
  assert.equal(m.id, "1");
  assert.equal(m.trail.length, 40);
  assert.deepEqual(m.predicted, [25.4, 50.1]);
  assert.equal(m.last_seen, (now - 60) * 1000);
  assert.equal(m.lat, 50.12346);
  assert.ok(!("channel" in m) && !("ai_id" in m));
  assert.equal(out[1].kind, "weird");
  assert.equal(out[1].predicted, null);
});
