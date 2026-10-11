/** Anonymous Web Push — subscription + watched voivodeships, no accounts. */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { VOIV } from "./fusion.mjs";
import { gminaById, powiatById } from "./admin.mjs";

const require = createRequire(import.meta.url);
const webpush = require("web-push");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
// Persistent dir (docker volume) when ZORYA_DATA_DIR is set; server/ otherwise (dev, old layout).
const dataDir = process.env.ZORYA_DATA_DIR || root;
fs.mkdirSync(dataDir, { recursive: true });
const vapidPath = path.join(dataDir, "vapid.json");
const subsPath = path.join(dataDir, "push-subs.json");
const COOLDOWN_MS = 10 * 60 * 1000;
/** Gmina places follow their powiat's level, which crosses thresholds more often than a voivodeship's: rarer repeats. */
const GMINA_COOLDOWN_MS = 30 * 60 * 1000;
const MAX_SUBS = 10_000;
const VOIV_IDS = new Set(VOIV.map((v) => v.id));
/** A push older than this is noise, not a warning: the push service drops it instead of delivering it late. */
const TTL_S = { priority: 15 * 60, watch: 30 * 60 };
const SEND_CONCURRENCY = 16;
const SEND_TIMEOUT_MS = 10_000;
// Browser push services only — the server POSTs to this URL, so an arbitrary endpoint would be an SSRF hole.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  ".push.apple.com",
  ".notify.windows.com",
];

function isPushEndpoint(endpoint) {
  let u;
  try {
    u = new URL(String(endpoint));
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  return PUSH_HOSTS.some((h) => (h.startsWith(".") ? u.hostname.endsWith(h) : u.hostname === h));
}

function loadVapid() {
  if (fs.existsSync(vapidPath)) {
    return JSON.parse(fs.readFileSync(vapidPath, "utf8"));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(vapidPath, JSON.stringify(keys, null, 2));
  return keys;
}

const vapid = loadVapid();
// Apple's push service rejects a VAPID subject without a real domain; set VAPID_SUBJECT in production.
webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:zorya-watch@localhost", vapid.publicKey, vapid.privateKey);

let subs = [];
try {
  if (fs.existsSync(subsPath)) {
    const saved = JSON.parse(fs.readFileSync(subsPath, "utf8"));
    subs = Array.isArray(saved) ? saved.filter((s) => s?.subscription?.endpoint) : [];
  }
} catch {
  subs = [];
}

function saveSubs() {
  // Write-then-rename, so a crash mid-write cannot leave a truncated JSON file.
  const tmp = `${subsPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(subs));
  fs.renameSync(tmp, subsPath);
}

export function pushPublicKey() {
  return vapid.publicKey;
}

const B64URL = /^[A-Za-z0-9_-]+=*$/;

export function upsertPushSub(body) {
  const subscription = body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error("zły endpoint");
  }
  const { endpoint } = subscription;
  const { p256dh, auth } = subscription.keys;
  if (typeof endpoint !== "string" || endpoint.length > 1024 || !isPushEndpoint(endpoint)) throw new Error("endpoint spoza usług Web Push");
  // P-256 public key (65 B → 87 chars) and 16-byte auth secret (→ 22 chars), base64url.
  if (typeof p256dh !== "string" || p256dh.length < 80 || p256dh.length > 100 || !B64URL.test(p256dh)) throw new Error("zły klucz p256dh");
  if (typeof auth !== "string" || auth.length < 16 || auth.length > 32 || !B64URL.test(auth)) throw new Error("zły klucz auth");
  if (!Array.isArray(body.places)) throw new Error("places musi być tablicą");
  const known = subs.some((s) => s.subscription.endpoint === endpoint);
  if (!known && subs.length >= MAX_SUBS) throw new Error("limit subskrypcji");
  // Two kinds of place: a voivodeship (slug, the original meaning, unchanged) or a gmina (7-digit TERYT), which is
  // notified by its powiat's level. Only the powiat and voivodeship are derived server-side; nothing else is kept.
  const places = body.places
    .slice(0, 8)
    .map((p) => {
      const base = { notifyWatch: !!p?.notifyWatch, notifyPriority: p?.notifyPriority !== false, name: String(p?.name || "").slice(0, 80) };
      const g = p?.gmina ? gminaById(String(p.gmina).replace(/\D/g, "").slice(0, 7)) : null;
      if (g) return { ...base, gmina: g.id, powiat: g.pow, voivodeship: g.woj, name: base.name || g.name };
      return { ...base, voivodeship: String(p?.voivodeship || "").slice(0, 40) };
    })
    .filter((p) => p.gmina || VOIV_IDS.has(p.voivodeship));
  subs = subs.filter((s) => s.subscription.endpoint !== subscription.endpoint);
  if (places.length) {
    subs.push({
      subscription: {
        endpoint,
        expirationTime: Number.isFinite(subscription.expirationTime) ? subscription.expirationTime : null,
        keys: { p256dh, auth },
      },
      places,
      lang: body.lang === "en" ? "en" : "pl",
      last: {},
    });
  }
  saveSubs();
  return { ok: true, watching: places.length };
}

export function removePushSub(endpoint) {
  if (typeof endpoint !== "string" || !endpoint) return;
  const before = subs.length;
  subs = subs.filter((s) => s.subscription.endpoint !== endpoint);
  // Only a real change touches the disk: unknown endpoints must not turn into free file writes.
  if (subs.length !== before) saveSubs();
}

/** Notification for a gmina place, from its powiat's level (null: nothing to send or still cooling down). */
function gminaJob(sub, place, p, now) {
  if (!p) return null;
  const priority = p.level === "priority" && place.notifyPriority;
  const watch = p.level === "watch" && place.notifyWatch;
  if (!priority && !watch) return null;
  const level = priority ? "priority" : "watch";
  const key = `p:${place.powiat}:${level}`;
  if ((sub.last?.[key] ?? 0) > now - GMINA_COOLDOWN_MS) return null;
  sub.last = sub.last || {};
  sub.last[key] = now;
  const en = sub.lang === "en";
  const powLabel = powiatById(place.powiat)?.label || place.powiat;
  const lvlWord = level === "priority" ? (en ? "PRIORITY" : "PRIORYTET") : en ? "WATCH" : "UWAGA";
  return {
    sub,
    level,
    topic: `z-p${place.powiat}-${level}`,
    payload: JSON.stringify({
      title: `Zorya · ${place.name} · ${lvlWord}`,
      body: `${powLabel}: ${Number(p.points).toFixed(1)} ${en ? "pts" : "pkt"}${p.why ? ` — ${p.why}` : ""}`,
      level,
      tag: `zorya-p${place.powiat}-${level}`,
      url: `/app/mapa?g=${place.gmina}`,
    }),
  };
}

let notifying = false;

export async function notifyFromState(state) {
  if (notifying || !subs.length || !state?.voivodeships) return;
  notifying = true;
  try {
    await notifyOnce(state);
  } finally {
    notifying = false;
  }
}

async function notifyOnce(state) {
  const now = Date.now();
  const byId = Object.fromEntries(state.voivodeships.map((v) => [v.id, v]));
  const pow = new Map((state.powiaty?.list || []).map(([id, l, pts, w]) => [id, { level: l === "p" ? "priority" : "watch", points: pts, why: state.powiaty.why[w] || "" }]));
  const jobs = [];
  let dirty = false;
  for (const sub of subs) {
    if (!sub.places?.length) continue;
    for (const place of sub.places) {
      if (place.gmina) {
        const job = gminaJob(sub, place, pow.get(place.powiat), now);
        if (job) {
          jobs.push(job);
          dirty = true;
        }
        continue;
      }
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
      const en = sub.lang === "en";
      const name = en ? v.nameEn : v.name;
      const why = en ? v.whyEn : v.whyPl;
      const lvlWord = level === "priority" ? (en ? "PRIORITY" : "PRIORYTET") : en ? "WATCH" : "UWAGA";
      const payload = JSON.stringify({
        title: `Zorya · ${name} · ${lvlWord}`,
        body: `${Number(v.points).toFixed(1)} ${en ? "pts" : "pkt"}${why ? ` — ${why}` : ""}`,
        level,
        tag: `zorya-${v.id}-${level}`,
      });
      // Topic (≤ 32 chars, base64url): a newer alert for the same region replaces an undelivered older one.
      jobs.push({ sub, payload, level, topic: `z-${v.id}-${level}` });
    }
  }
  const gone = new Set();
  // Bounded parallelism: thousands of subscribers must not be sent one by one, nor all at once.
  for (let i = 0; i < jobs.length; i += SEND_CONCURRENCY) {
    await Promise.all(
      jobs.slice(i, i + SEND_CONCURRENCY).map(async ({ sub, payload, level, topic }) => {
        if (gone.has(sub.subscription.endpoint)) return;
        try {
          await webpush.sendNotification(sub.subscription, payload, {
            TTL: TTL_S[level],
            urgency: level === "priority" ? "high" : "normal",
            topic,
            timeout: SEND_TIMEOUT_MS,
          });
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) gone.add(sub.subscription.endpoint);
          else console.error("Zorya push", err.statusCode || err.message);
        }
      })
    );
  }
  if (gone.size) subs = subs.filter((s) => !gone.has(s.subscription.endpoint));
  if (dirty || gone.size) saveSubs();
}
