// Service worker for the ManageMyMiles app shell.
//
// Deliberately narrow scope: it only ever caches this app's own static
// files (index.html, manifest, icons). It never intercepts requests to
// Supabase (auth, database, edge functions) or any other origin — those
// always go straight to the network, so login and your data are never
// served stale or broken from a cache.
//
// Bump CACHE_NAME whenever you change index.html so old caches are cleared.
const CACHE_NAME = "mileage-app-shell-v2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests (the app shell itself).
  // Everything else — Supabase, DVLA/postcode functions, CDN scripts —
  // is left completely alone and goes straight to the network.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      // Serve from cache instantly if we have it (fast + works offline),
      // while quietly refreshing the cache from the network in the background.
      return cached || networkFetch;
    })
  );
});
