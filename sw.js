// HEDGE OS service worker: shell caching + offline fallback for market APIs. Version bump on each release.
const CACHE = 'hedge-os-v24';
const API_HOSTS = ['api.frankfurter.dev', 'api.cbs.gov.il', 'data.sec.gov'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./index.html'])));
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
    // Network-first for live market data; cached copy as offline fallback.
    e.respondWith(
      fetch(e.request)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request).then((hit) => hit || Promise.reject(new Error('offline'))))
    );
    return;
  }
  if (url.origin === self.location.origin && e.request.mode === 'navigate') {
    // HTML is network-first so an installed app never remains on an older asset version.
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const cp=r.clone(); caches.open(CACHE).then(c=>c.put('./index.html',cp)); }
      return r;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  if (url.origin === self.location.origin) {
    // Stale-while-revalidate for the app shell and assets.
    e.respondWith(
      caches.match(e.request).then((hit) => {
        const fresh = fetch(e.request)
          .then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return r; })
          .catch(() => hit);
        return hit || fresh;
      })
    );
  }
});
