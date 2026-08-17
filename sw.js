const CACHE_NAME = 'carol-alves-pwa-v7';

// Core static assets for offline capability
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/js/pwa.js',
  '/manifest.json',
  '/assets/icons/icon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon-32.png'
];

// Install Event - Pre-cache minimal core shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PWA SW] Pre-caching minimal shell...');
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[PWA SW] Pre-cache non-fatal warning:', err);
      });
    })
  );
});

// Activate Event - Purge all old caches immediately and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[PWA SW] Deleting stale cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Allow clients to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Event Handler with strict freshness rules
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET or cross-origin/extension requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. Dynamic API, Admin & JSON Data: ALWAYS NETWORK ONLY (Never cache admin or stale product/category data)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/data/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/painel') ||
    url.pathname.startsWith('/pages/admin')
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => {
        return new Response(JSON.stringify({ error: 'Você está offline.', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. HTML Pages and JS Scripts: NETWORK FIRST (Always fetch latest version, fallback to cache if offline)
  if (
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 3. Static Assets (Images, Icons, CSS): STALE-WHILE-REVALIDATE
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || networkFetch;
    })
  );
});

