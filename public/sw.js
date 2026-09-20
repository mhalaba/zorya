/* Zorya service worker — shell, fonts, last state; Web Push */
const CACHE = "zorya-v4";
const PRECACHE = [
  "/",
  "/app",
  "/app/mapa",
  "/manifest.webmanifest",
  "/css/tokens.css",
  "/icons/favicon.svg",
  "/icons/zorya-mark-mono.svg",
  "/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2",
  "/fonts/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ws")) {
    if (url.pathname === "/api/status" || url.pathname === "/api/horizon") {
      event.respondWith(
        fetch(event.request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(event.request, copy));
            }
            return res;
          })
          .catch(() => caches.match(event.request))
      );
    }
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fresh = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      if (url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/css/")) {
        return cached || fresh;
      }
      return fresh.then((r) => r || cached);
    })
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = { title: "Zorya", body: "", level: "obserwacja", tag: "zorya", url: "/app/mapa" };
      try {
        data = { ...data, ...(event.data ? event.data.json() : {}) };
      } catch {
        /* ignore */
      }
      const alarm = data.level === "alarm" || data.level === "priority";
      await self.registration.showNotification(data.title || "Zorya", {
        body: data.body || "",
        silent: data.level === "obserwacja" || data.level === "zrodla",
        requireInteraction: alarm,
        tag: data.tag || "zorya",
        icon: "/icons/app-icon-192.png",
        badge: "/icons/app-icon-192.png",
        data: { url: data.url || "/app/mapa" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/mapa";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate?.(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
