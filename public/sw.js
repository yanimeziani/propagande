/* Propagande offline: once a page has been opened, the app opens and runs without internet (« mode avion »).
 * The voice model is kept separately in the browser's file storage (src/lib/clips/model-store.ts); this
 * worker keeps the app itself: hashed build files cache-first, pages network-first with the cached copy as
 * fallback. Only same-origin GET requests; the anonymous counts (/e/) are never cached. */
const CACHE = "propagande-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/e/")) return;
  if (req.headers.has("range")) return; // video seeking: let the browser handle it

  if (url.pathname.startsWith("/_next/static/")) {
    // build files never change under the same name: cache first
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // pages and other files: the network when there is one, the last copy when there isn't
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("/propagande/")))
  );
});
