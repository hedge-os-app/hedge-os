// HEDGE OS service worker: shell caching + offline fallback for market APIs.
const CACHE = 'hedge-os-pwa-v3';
const SHELL = ['./index.html', './app.js', './app.css', './manifest.webmanifest',
  './pwa-icons/icon-192.png', './pwa-icons/icon-512.png', './pwa-icons/apple-touch-icon.png'];
const API_HOSTS = ['api.frankfurter.dev', 'api.cbs.gov.il', 'data.sec.gov', 'open.er-api.com', 'r.jina.ai', 'api.twelvedata.com'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (API_HOSTS.includes(url.host)) {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request).then((hit) => hit || Promise.reject(new Error('offline'))))
    );
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
        const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r;
      }))
    );
  }
});
