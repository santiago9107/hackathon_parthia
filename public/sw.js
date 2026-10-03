/* Parthia Health service worker — app-shell caching + notifications.
 *
 * Hand-rolled (no Workbox) so it is easy to read:
 *  - install:  precache the app shell (routes, manifest, icons)
 *  - fetch:    navigations → network first, fall back to cache, then to "/"
 *              static assets (/_next/static, icons, fonts) → cache first
 *  - push:     show a notification (payload from the push service)
 *  - message:  SCHEDULE_NOTIFICATION → local timer → showNotification
 *  - notificationclick → focus an open window or open the target URL
 *
 * Mock data ships inside the JS bundles, so caching the app shell also caches
 * the data — the whole demo works offline after the first visit.
 */
const VERSION = "parthia-v8";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_URLS = [
  "/",
  "/medications/",
  "/trends/",
  "/share/",
  "/assistant/",
  "/install/",
  "/about/",
  "/log/",
  "/log/mood/",
  "/log/symptom/",
  "/log/meal/",
  "/log/vitals/",
  "/log/medication/",
  "/log/appointment/",
  "/log/allergy/",
  "/log/nutrition-profile/",
  "/log/emergency/",
  "/log/phq-9/",
  "/log/gad-7/",
  "/passport/",
  "/passport/timeline/",
  "/passport/clinical/",
  "/passport/medications/",
  "/passport/nutrition/",
  "/passport/mental-health/",
  "/passport/appointments/",
  "/passport/documents/",
  "/passport/sources/",
  "/passport/share/",
  "/passport/emergency/",
  "/passport/review/",
  "/passport/activity/",
  "/passport/settings/",
  "/passport/add/",
  "/passport/add/epic/",
  "/passport/add/scan/",
  "/passport/add/apple-health/",
  "/passport/add/device/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/badge-96.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL_URLS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    // On-device OCR engine + language data and the sample documents: cache after first use (works offline).
    url.pathname.startsWith("/ocr/") ||
    url.pathname.startsWith("/samples/") ||
    /\.(png|svg|ico|woff2?|css|js)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          // Try the trailing-slash variant, then the root shell.
          const alt = await caches.match(url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`);
          return alt || caches.match("/");
        }),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
  }
});

/* ---- Notifications ------------------------------------------------------ */

function show(title, body, url) {
  return self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: `parthia-${url}`,
    renotify: true,
    data: { url: url || "/" },
  });
}

self.addEventListener("push", (event) => {
  let payload = { title: "Parthia Health", body: "You have a new reminder.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(show(payload.title, payload.body, payload.url));
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SCHEDULE_NOTIFICATION") {
    const delay = Math.max(0, Number(msg.delayMs) || 0);
    setTimeout(() => show(msg.title, msg.body, msg.url), delay);
  }
  if (msg.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
