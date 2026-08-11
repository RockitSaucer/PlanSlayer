/* PlanSlayer service worker — shell cache + offline map tiles */
const SHELL_CACHE = 'plan-slayer-shell-v57';
const TILE_CACHE = 'plan-slayer-tiles-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './auth.js',
  './app.js',
  './plan-map.js',
  './manifest.webmanifest',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/marker-icon.png',
  './vendor/leaflet/marker-icon-2x.png',
  './vendor/leaflet/marker-shadow.png',
  './icons/app/plan-192.png',
  './icons/app/plan-512.png'
];

function isMapTileRequest(url) {
  try {
    const u = new URL(url);
    const h = u.hostname;
    if (h.includes('basemap.nationalmap.gov')) return true;
    if (h.includes('arcgisonline.com') && u.pathname.includes('/tile/')) return true;
    if (h.includes('basemaps.cartocdn.com')) return true;
    if (h.includes('tile.openstreetmap.org')) return true;
  } catch (e) {}
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(SHELL_ASSETS.map((p) => cache.add(p).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // Offline map packs: cache-first for tile hosts
  if (isMapTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req)
            .then((res) => {
              if (res && res.ok) {
                try { cache.put(req, res.clone()); } catch (e) {}
              }
              return res;
            })
            .catch(() => cached || Response.error());
        })
      )
    );
    return;
  }

  if (!url.startsWith(self.registration.scope)) return;
  // Network-first for app shell so deploys show up
  if (req.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/app.js') || url.endsWith('/auth.js') || url.endsWith('/plan-map.js') || url.endsWith('/sw.js')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached || Response.error());
      return cached || net;
    })
  );
});
