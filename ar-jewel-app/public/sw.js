// Offline shell for the booth: try-on works with no internet (FR-18). Photos and API calls are never cached.
const CACHE = 'booth-v1';
const STATIC = ['/mediapipe/', '/assets/', '/uploads/'];

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/catalog.json']).catch(() => {}))); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const cacheFirst = STATIC.some((p) => url.pathname.startsWith(p));
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (cacheFirst && hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch { if (hit) return hit; throw new Error('offline'); }
  })());
});
