// ============================================================
// sw.js — 小熊记账 Service Worker
// 离线优先策略：静态资源缓存优先 + SPA降级
// ============================================================

const STATIC_CACHE = 'billapp-s-v3';
const DYNAMIC_CACHE = 'billapp-d-v3';

const STATIC_ASSETS = [
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

// ==================== 安装：预缓存全部静态资源 ====================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ==================== 激活：清理旧缓存 ====================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

// ==================== 请求拦截 ====================
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  const ext = url.pathname.split('.').pop().toLowerCase();
  const isStatic = ['js', 'css', 'png', 'svg', 'ico', 'json', 'webmanifest'].includes(ext);

  if (isStatic) {
    // 静态资源：缓存优先，网络回退
    event.respondWith(cacheFirst(req));
  } else if (req.mode === 'navigate') {
    // 页面导航：网络优先，缓存兜底，最后回退到 index.html
    event.respondWith(networkFirstOrShell(req));
  } else {
    // 其他请求（如 fetch API）：网络优先，缓存兜底
    event.respondWith(networkFirst(req));
  }
});

// ==================== 缓存策略 ====================

// 缓存优先：先读缓存，找不到再从网络获取并缓存
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

// 网络优先：先尝试网络，失败后用缓存
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('', { status: 408, statusText: 'Offline' });
  }
}

// 页面导航：网络优先，网络失败则用缓存的 index.html（SPA降级）
async function networkFirstOrShell(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    const shell = await caches.match('/index.html');
    if (shell) return shell;
    // 最后的最终降级：内联一个简单的离线提示
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>离线</title><style>body{font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;color:#636e72;text-align:center;padding:20px}h1{font-size:48px;margin-bottom:8px}p{font-size:16px;line-height:1.6}</style></head><body><h1>🐻</h1><p>小熊记账已离线<br>请连接网络后刷新重试</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ==================== 消息通道 ====================
self.addEventListener('message', event => {
  const data = event.data;
  if (!data) return;
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CACHE_UPDATED':
      if (data.urls) {
        caches.open(STATIC_CACHE).then(cache => cache.addAll(data.urls));
      }
      break;
  }
});

// ==================== 在线状态广播 ====================
function broadcastOnlineStatus(isOnline) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'ONLINE_STATUS', online: isOnline });
    });
  });
}

self.addEventListener('online', () => broadcastOnlineStatus(true));
self.addEventListener('offline', () => broadcastOnlineStatus(false));
// 启动时告知当前状态
self.addEventListener('activate', () => broadcastOnlineStatus(navigator.onLine));
