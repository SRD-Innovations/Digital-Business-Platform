self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("dbp-shell-v1").then((cache) =>
      cache.addAll(["/", "/login", "/dashboard", "/dashboard/pos"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // App-shell only: never intercept API calls.
  if (url.pathname.startsWith("/v1") || url.hostname.includes("onrender")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open("dbp-shell-v1").then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
