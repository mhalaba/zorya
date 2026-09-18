/* Zorya service worker — cache geo + shell, Web Push when the tab is closed */
const CACHE = "zorya-v2";
const PRECACHE = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ws")) return;
  if (url.pathname.startsWith("/geo/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fresh = fetch(event.request)
          .then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fresh;
      })
    );
  }
});

self.addEventListener("push", (event) => {
  // Always show it: subscriptions use userVisibleOnly, and a push without a notification makes
  // Chrome show a generic one and Safari revoke the subscription after a few silent pushes.
  event.waitUntil(
    (async () => {
      let data = { title: "Zorya", body: "", level: "watch", tag: "zorya" };
      try {
        data = { ...data, ...(event.data ? event.data.json() : {}) };
      } catch {
        /* ignore */
      }
      const priority = data.level === "priority";
      await self.registration.showNotification(data.title || "Zorya", {
        body: data.body || "",
        silent: !priority,
        requireInteraction: priority,
        tag: data.tag || "zorya",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: "/" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
