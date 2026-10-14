import test from "node:test";
import assert from "node:assert/strict";
import { latLngToCell } from "h3-js";
import { LiveAgg, classify, level, parseDaily } from "./gnss.mjs";

test("classify uses NACp/NIC and skips non-ADS-B, ground and unknown", () => {
  assert.equal(classify({ lat: 52, lon: 19, type: "adsb_icao", nic: 8, nac_p: 9 }), false);
  assert.equal(classify({ lat: 52, lon: 19, type: "adsb_icao", nic: 0, nac_p: 0 }), true);
  assert.equal(classify({ lat: 52, lon: 19, type: "adsb_icao", nic: 8, nac_p: 7 }), true);
  assert.equal(classify({ lat: 52, lon: 19, type: "mlat", nic: 0 }), null);
  assert.equal(classify({ lat: 52, lon: 19, type: "adsb_icao", alt_baro: "ground", nic: 0 }), null);
  assert.equal(classify({ lat: 52, lon: 19 }), null);
  assert.equal(classify({ type: "adsb_icao", nic: 8 }), null);
});

test("level follows gpsjam thresholds and needs a minimum sample", () => {
  assert.equal(level(1, 1), 0);
  assert.equal(level(0, 50), 0);
  assert.equal(level(2, 48), 1);
  assert.equal(level(6, 40), 2);
});

test("parseDaily keeps degraded cells inside the area only", () => {
  const pl = latLngToCell(54.6, 20.5, 4);
  const us = latLngToCell(40, -100, 4);
  const ok = latLngToCell(52, 19, 4);
  const csv = `hex,count_good_aircraft,count_bad_aircraft\n${pl},10,30\n${us},1,50\n${ok},100,0\nbroken,1,1\n`;
  const f = parseDaily(csv, "2026-10-13");
  assert.equal(f.length, 1);
  assert.equal(f[0].properties.h3, pl);
  assert.equal(f[0].properties.level, 2);
  assert.equal(f[0].properties.pct, 75);
  assert.equal(f[0].geometry.type, "Polygon");
});

test("LiveAgg counts each aircraft once per cell, sticky bad, window pruning", () => {
  const a = new LiveAgg(60_000);
  const t = 1_000_000;
  const base = { type: "adsb_icao", lat: 54.6, lon: 20.5 };
  a.add([{ ...base, hex: "a", nic: 0, nac_p: 0 }, { ...base, hex: "b", nic: 8, nac_p: 9 }, { ...base, hex: "c", nic: 8, nac_p: 9 }], t);
  a.add([{ ...base, hex: "a", nic: 8, nac_p: 10 }], t + 1000);
  const f = a.features(t + 2000);
  assert.equal(f.length, 1);
  assert.equal(f[0].properties.bad, 1);
  assert.equal(f[0].properties.good, 2);
  assert.equal(a.features(t + 120_000).length, 0);
});
