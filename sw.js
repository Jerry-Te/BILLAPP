// ============================================================
// sw.js - Bear Accounting Service Worker
// Offline First: App Shell First for navigation,
// Cache-First for static assets, Network-First with timeout for others
// ============================================================

var STATIC_CACHE = 'billapp-s-v5';
var DYNAMIC_CACHE = 'billapp-d-v5';
var CACHE_PREFIX = 'billapp';

var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/db.js',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-1024.png'
];

// ==================== Install: pre-cache all static assets ====================
self.addEventListener('install', function(event) {
  console.log('[SW] install started', new Date().toISOString());
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).then(function() {
        console.log('[SW] install complete, assets cached:', STATIC_ASSETS.length);
        return self.skipWaiting();
      });
    }).catch(function(err) {
      console.error('[SW] install FAILED:', err);
    })
  );
});

// ==================== Activate: clean old caches, take control ====================
self.addEventListener('activate', function(event) {
  console.log('[SW] activate started', new Date().toISOString());
  event.waitUntil(
    caches.keys().then(function(keys) {
      var deletePromises = [];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf(CACHE_PREFIX) !== 0) continue;
        if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
          console.log('[SW] deleting old cache:', key);
          deletePromises.push(caches.delete(key));
        }
      }
      return Promise.all(deletePromises);
    }).then(function() {
      console.log('[SW] activate complete, claiming clients...');
      broadcastOnlineStatus(navigator.onLine);
      return self.clients.claim();
    }).then(function() {
      console.log('[SW] clients claimed, active cache:', STATIC_CACHE);
    })
  );
});

// ==================== Fetch: interception ====================
self.addEventListener('fetch', function(event) {
  var req = event.request;
  var url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  var path = url.pathname;

  // Never intercept SW update checks
  if (path.indexOf('/sw.js') >= 0) {
    return;
  }

  var parts = path.split('.');
  var ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  var isStatic = ['js', 'css', 'png', 'svg', 'ico', 'json', 'webmanifest'].indexOf(ext) >= 0;

  if (isStatic) {
    // Static assets: Cache-First
    event.respondWith(cacheFirst(req, path));
  } else if (req.mode === 'navigate') {
    // Navigation: App Shell First (serve cached immediately, background-refresh)
    event.respondWith(shellFirst(req));
  } else {
    // Other requests: Network-First with 4s timeout
    event.respondWith(networkFirstWithTimeout(req, 4000));
  }
});

// ==================== Cache-First for static assets ====================
async function cacheFirst(req, path) {
  var cached = await caches.match(req);
  if (cached) {
    console.log('[SW] cache HIT:', path);
    return cached;
  }
  console.log('[SW] cache MISS:', path, '- fetching network');
  try {
    var res = await fetch(req);
    if (res && res.ok) {
      var cache = await caches.open(STATIC_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    console.warn('[SW] network FAILED:', path);
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

// ==================== App Shell First for navigation ====================
async function shellFirst(req) {
  var cached = await caches.match(req);
  if (cached) {
    console.log('[SW] navigation from CACHE:', req.url);
    // Background refresh: update cache from network, fire-and-forget
    caches.open(DYNAMIC_CACHE).then(function(cache) {
      fetch(req).then(function(res) {
        if (res && res.ok) {
          cache.put(req, res);
          console.log('[SW] navigation cache UPDATED');
        }
      }).catch(function() {});
    });
    return cached;
  }
  console.log('[SW] navigation CACHE MISS - trying network');
  try {
    var res = await fetch(req);
    if (res && res.ok) {
      var cache = await caches.open(DYNAMIC_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    console.warn('[SW] navigation network FAILED - shell fallback');
    var fallback = await caches.match('/index.html');
    if (fallback) return fallback;
    console.warn('[SW] no fallback found - serving inline offline page');
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline</title><style>body{font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;color:#636e72;text-align:center;padding:20px}h1{font-size:48px;margin-bottom:8px}p{font-size:16px;line-height:1.6}</style></head><body><h1>\ud83d\udc3b</h1><p>Offline<br>Connect to internet and refresh</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ==================== Network-First with timeout ====================
async function networkFirstWithTimeout(req, timeout) {
  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, timeout);
  try {
    var res = await fetch(req, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res && res.ok) {
      var cache = await caches.open(DYNAMIC_CACHE);
      cache.put(req, res.clone());
    }
    console.log('[SW] fetch from NETWORK:', req.url);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    var cached = await caches.match(req);
    if (cached) {
      console.log('[SW] fetch from CACHE (network failed):', req.url);
      return cached;
    }
    console.warn('[SW] fetch FAILED:', req.url);
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

// ==================== Online/Offline broadcast ====================
function broadcastOnlineStatus(isOnline) {
  self.clients.matchAll().then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({ type: 'ONLINE_STATUS', online: isOnline });
    });
  });
}

self.addEventListener('online', function() { broadcastOnlineStatus(true); });
self.addEventListener('offline', function() { broadcastOnlineStatus(false); });

// ==================== Message handler ====================
self.addEventListener('message', function(event) {
  var data = event.data;
  if (!data) return;
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'GET_CACHE_INFO':
      caches.open(STATIC_CACHE).then(function(cache) {
        cache.keys().then(function(keys) {
          event.source.postMessage({
            type: 'CACHE_INFO',
            cacheName: STATIC_CACHE,
            itemCount: keys.length,
            items: keys.map(function(k) { return k.url; })
          });
        });
      });
      break;
  }
});

console.log('[SW] loaded, version:', STATIC_CACHE);
