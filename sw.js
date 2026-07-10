const APP_VERSION = 'v1.2.2';
const CACHE_NAME = 'billapp-' + APP_VERSION;
const STATIC_ASSETS = [
  './',
  './index.html?v=1.2.2',
  './manifest.json?v=1.2.2',
  './css/app.css?v=1.2.2',
  './js/db.js?v=1.2.2',
  './js/app.js?v=1.2.2',
  './icons/icon-192.png?v=1.2.2',
  './icons/icon-512.png?v=1.2.2',
  './icons/icon-1024.png?v=1.2.2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_ASSETS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
      self.clients.claim();
    })()
  );
});

function withVersion(request) {
  if (request.method !== 'GET') return request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return request;
  if (url.searchParams.get('v') === APP_VERSION) return request;
  url.searchParams.set('v', APP_VERSION);
  return new Request(url, request);
}

self.addEventListener('fetch', event => {
  const versionedRequest = withVersion(event.request);
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(versionedRequest);
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(versionedRequest, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        const cachedResponse = await caches.match(versionedRequest);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match('./index.html');
          if (fallback) return fallback;
        }
        return new Response('离线模式', { status: 503 });
      }
    })()
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_UPDATED') {
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(event.data.urls);
    });
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
