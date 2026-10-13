// Run: node --test server/push.test.mjs   (temp data dir; nothing is sent)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ZORYA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "zorya-push-"));
const { upsertPushSub } = await import("./push.mjs");

const sub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
};

test("places: voivodeship slugs keep their meaning, gminy are validated and get their powiat", () => {
  const out = upsertPushSub({
    subscription: sub,
    places: [
      { voivodeship: "lubelskie", name: "dom" },
      { gmina: "0619072", name: "" },
      { gmina: "9999999" }, // unknown gmina: dropped
      { voivodeship: "2401011" }, // TERYT where a slug belongs: dropped (old client bug)
    ],
  });
  assert.equal(out.watching, 2);
  const saved = JSON.parse(fs.readFileSync(path.join(process.env.ZORYA_DATA_DIR, "push-subs.json"), "utf8"));
  const [v, g] = saved[0].places;
  assert.equal(v.voivodeship, "lubelskie");
  assert.deepEqual([g.gmina, g.powiat, g.voivodeship, g.name], ["0619072", "0619", "lubelskie", "Wola Uhruska"]);
});
