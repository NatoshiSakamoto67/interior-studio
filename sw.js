/* Interior Studio — Service Worker (nur im sicheren Kontext aktiv: https / localhost).
   Macht die App auf dem Handy installierbar und nach dem ersten Laden offline-fähig.
   Strategie: gleiche Herkunft = cache-first (App-Shell); APIs/CDN = immer Netz. */
const CACHE = "interior-studio-v1";
const CORE = ["./", "./index.html", "./style.css", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIs (Gemini/OpenAI/Claude/Marble) + CDN: immer Netz
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
