/**
 * Ledger service worker.
 * Caches the app shell (HTML/manifest/icons) so the app installs and opens
 * offline. It deliberately does NOT cache calls to the Apps Script API —
 * transaction data always goes live to the Google Sheet, never stale.
 */
const CACHE_NAME = 'ledger-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cross-origin requests (the Apps Script /exec endpoint) always go to the
  // network untouched — never served from cache, never cached.
  if (url.origin !== location.origin) {
    return;
  }

  // Same-origin shell files: cache-first, falling back to network, and
  // updating the cache in the background so the next load picks up changes.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
