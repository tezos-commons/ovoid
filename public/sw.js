/**
 * Minimal service worker — just enough to make Ovoid installable (Chrome's
 * install prompt needs a SW with a fetch handler) and to open offline as an app
 * shell. Deliberately does NOT cache hashed assets or API responses:
 *   - asset requests pass straight through, so Vite HMR in dev is untouched and
 *     deploys are never served stale;
 *   - cross-origin requests (Bluesky / objkt / tzbsky / OAuth) are never
 *     intercepted;
 *   - only the app shell ("/") is cached, as the offline navigation fallback.
 */
const SHELL_CACHE = 'ovoid-shell-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add('/'))
      .catch(() => {}),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Only the document navigation is handled: network-first (always fresh),
  // falling back to the cached shell when offline. Everything else (assets,
  // APIs, cross-origin) is left to the browser's default handling.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')))
  }
})
