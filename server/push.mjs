/** Anonymous Web Push — subscription + watched voivodeships, no accounts. */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const webpush = require("web-push");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const vapidPath = path.join(root, "vapid.json");
const subsPath = path.join(root, "push-subs.json");
const COOLDOWN_MS = 10 * 60 * 1000;

function loadVapid() {
  if (fs.existsSync(vapidPath)) {
    return JSON.parse(fs.readFileSync(vapidPath, "utf8"));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(vapidPath, JSON.stringify(keys, null, 2));
  return keys;
}

const vapid = loadVapid();
webpush.setVapidDetails("mailto:zorya-watch@localhost", vapid.publicKey, vapid.privateKey);

let subs = [];
try {
  if (fs.existsSync(subsPath)) subs = JSON.parse(fs.readFileSync(subsPath, "utf8")) || [];
} catch {
  subs = [];
}

function saveSubs() {
  fs.writeFileSync(subsPath, JSON.stringify(subs));
}

export function pushPublicKey() {
  return vapid.publicKey;
}

export function upsertPushSub(body) {
  const subscription = body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error("zły endpoint");
  }
  const places = (body.places || [])
    .slice(0, 8)
    .map((p) => ({
      voivodeship: String(p.voivodeship || "").slice(0, 40),
      notifyWatch: !!p.notifyWatch,
      notifyPriority: p.notifyPriority !== false,
      name: String(p.name || "").slice(0, 80),
    }))
    .filter((p) => p.voivodeship);
  subs = subs.filter((s) => s.subscription.endpoint !== subscription.endpoint);
  if (places.length) {
    subs.push({
      subscription,
      places,
      lang: body.lang === "en" ? "en" : "pl",
      last: {},
    });
  }
  saveSubs();
  return { ok: true, watching: places.length };
}

export function removePushSub(endpoint) {
  if (!endpoint) return;
  subs = subs.filter((s) => s.subscription.endpoint !== endpoint);
  saveSubs();
}

export async function notifyFromState(state) {
  if (!subs.length || !state?.voivodeships) return;
  const now = Date.now();
  const byId = Object.fromEntries(state.voivodeships.map((v) => [v.id, v]));
  let dirty = false;
  for (const sub of [...subs]) {
    if (!sub.places?.length) continue;
    for (const place of sub.places) {
      const v = byId[place.voivodeship];
      if (!v) continue;
      const priority = v.level === "priority" && place.notifyPriority;
      const watch = v.level === "watch" && place.notifyWatch;
      if (!priority && !watch) continue;
      const level = priority ? "priority" : "watch";
      const key = `${place.voivodeship}:${level}`;
      if ((sub.last?.[key] ?? 0) > now - COOLDOWN_MS) continue;
      sub.last = sub.last || {};
      sub.last[key] = now;
      dirty = true;
      const name = sub.lang === "en" ? v.nameEn : v.name;
      const why = sub.lang === "en" ? v.whyEn : v.whyPl;
      const lvlWord =
        level === "priority" ? (sub.lang === "en" ? "PRIORITY" : "PRIORYTET") : sub.lang === "en" ? "WATCH" : "UWAGA";
      const payload = JSON.stringify({
        title: `Zorya · ${name} · ${lvlWord}`,
        body: `${Number(v.points).toFixed(1)} pkt${why ? ` — ${why}` : ""}`,
        level,
        tag: `zorya-${v.id}-${level}`,
      });
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          subs = subs.filter((s) => s.subscription.endpoint !== sub.subscription.endpoint);
          dirty = true;
        } else {
          console.error("Zorya push", err.statusCode || err.message);
        }
      }
    }
  }
  if (dirty) saveSubs();
}
