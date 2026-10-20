// Heart of Wool — minimal service worker
// Goal: make the site installable as a PWA and avoid a blank white screen
// on a flaky connection. Deliberately NOT an aggressive offline-first cache,
// since product/order data must always come from the network when available.

const CACHE_NAME = "how-shell-v1";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Non-fatal if a shell asset is missing; don't block install.
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests; let everything else (POST to Supabase, etc.) pass through.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle same-origin requests — never intercept Supabase/API calls.
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first, so users always get the latest app
  // shell when online, falling back to cache only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets (icons, images, fonts, built JS/CSS): cache-first for speed,
  // fall back to network and cache the result.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
