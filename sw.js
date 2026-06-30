/* Interior Studio — Service Worker (nur im sicheren Kontext: https / localhost).
   NETWORK-FIRST: online immer die frische Version (Updates erscheinen sofort),
   Cache nur als Offline-Fallback. (Cache-first verschluckte sonst Deploys.) */
const CACHE = "interior-studio-v3";
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
  // Network-first: frische Antwort holen + Cache aktualisieren; offline -> Cache.
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});
