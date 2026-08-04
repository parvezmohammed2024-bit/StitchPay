const CACHE_NAME = 'stitchpay-app-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Offline HTML Page fallback
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StitchPay - Offline</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #FAFAF9;
      color: #1C1917;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .card {
      background: white;
      padding: 2.5rem 2rem;
      border-radius: 1.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid #E7E5E4;
      max-width: 360px;
      width: 85%;
    }
    .icon-box {
      width: 72px;
      height: 72px;
      background: #EEF2FF;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem auto;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 800;
      color: #1E1B4B;
      margin: 0 0 0.5rem 0;
    }
    p {
      font-size: 0.875rem;
      color: #78716C;
      margin: 0 0 1.5rem 0;
      line-height: 1.5;
    }
    button {
      background: #4338CA;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      font-size: 0.875rem;
      font-weight: 700;
      border-radius: 0.75rem;
      cursor: pointer;
      width: 100%;
    }
    button:active {
      transform: scale(0.98);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">
      <img src="/icon-192.png" width="48" height="48" alt="StitchPay" style="border-radius:50%">
    </div>
    <h1>You are currently offline</h1>
    <p>Please check your internet connection to sync garment logs and payroll data.</p>
    <button onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      cache.put('/offline.html', new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } }));
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: NEVER cache Supabase API calls or WebSocket/Auth endpoints
  if (
    url.hostname.includes('supabase') ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/auth/v1') ||
    url.pathname.includes('/realtime') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match('/index.html') || await cache.match('/');
        if (cachedResponse) {
          return cachedResponse;
        }
        const offlineRes = await cache.match('/offline.html');
        return offlineRes || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } });
      })
    );
    return;
  }

  // Static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).catch(async () => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          const cache = await caches.open(CACHE_NAME);
          return cache.match('/offline.html');
        }
      });
    })
  );
});
