import { useStore } from "./store";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a) return true;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

let chain: Promise<void> = Promise.resolve();

export function syncPushSubscription() {
  chain = chain.then(sync).catch((err) => console.warn("Zorya push", err));
  return chain;
}

async function sync() {
  const { notifyGranted, areas } = useStore.getState();
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
  const reg = await navigator.serviceWorker.ready;
  if (!notifyGranted || Notification.permission !== "granted") {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      }).catch(() => undefined);
      await existing.unsubscribe().catch(() => undefined);
    }
    return;
  }
  const places = areas.map((p) => ({
    voivodeship: p.area.id,
    notifyWatch: true,
    notifyPriority: true,
    name: p.area.name,
  }));
  if (!places.length) return;
  const keyRes = await fetch("/api/push/key");
  if (!keyRes.ok) return;
  const { publicKey } = (await keyRes.json()) as { publicKey: string };
  const key = urlBase64ToUint8Array(publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => undefined);
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), places, lang: "pl" }),
  });
}
