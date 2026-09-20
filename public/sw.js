/* GTU Study Tracker — offline shell.
   App shell is cached so the tracker opens without a network.

   API rule: only GLOBAL, shared endpoints are cached, and only when the
   response is ok. Session-specific endpoints (/api/state, /api/auth/*, …)
   are NEVER cached — a cached "not signed in" would silently log the user
   out on the next offline/hiccup reload. */

const CACHE = "gtu-study-v3";
const SHELL = ["/", "/plan", "/session", "/library", "/progress", "/settings", "/manifest.webmanifest", "/icon.png"];

/* shared reference data — safe to cache for everyone */
const CACHEABLE_API = new Set(["/api/library", "/api/health", "/api/faculty"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    if (!CACHEABLE_API.has(url.pathname)) {
      /* user-specific / session endpoint — always live, never cached */
      event.respondWith(
        fetch(request).catch(
          () => new Response(JSON.stringify({ offline: true }), { headers: { "content-type": "application/json" } }),
        ),
      );
      return;
    }
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || new Response(JSON.stringify({ offline: true }), { headers: { "content-type": "application/json" } }))),
    );
    return;
  }

  /* pages are NETWORK-FIRST: a cache-first page would keep serving stale
     app code (old login page without the session-token fix) after deploys */
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
