/**
 * Service worker: installability (Chrome's install prompt needs a fetch
 * handler), offline app shell, and repeat-visit caching for immutable content.
 *
 *   - "/" (the shell) is cached as the offline navigation fallback;
 *     navigations themselves are network-first so deploys are never stale.
 *   - Same-origin "/assets/*" is cache-first: Vite content-hashes every file
 *     there, so a cached entry can never be wrong — repeat visits and the
 *     offline shell get their JS/CSS without the network. Dev is untouched
 *     (the dev server serves /src/*, not /assets/*).
 *   - cdn.bsky.app images (avatars, thumbs) are cache-first with a size cap:
 *     blob URLs are content-addressed, so they're immutable too.
 *   - Everything else (XRPC, OAuth, objkt, video) passes straight through.
 *
 * Push: payloads arrive in the Declarative Web Push shape
 * ({"web_push": 8030, "notification": {title, body, navigate, tag}}) from the
 * notify service. Safari 18.4+ renders them natively without waking us; on
 * every other browser the `push` handler below parses the same JSON. Apple
 * revokes subscriptions that don't show a visible notification, so the
 * handler always calls showNotification.
 */
const SHELL_CACHE = 'ovoid-shell-v1'
const ASSET_CACHE = 'ovoid-assets-v1'
const IMG_CACHE = 'ovoid-img-v1'
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE, IMG_CACHE]

/** Image entries kept; oldest-inserted evicted beyond this. */
const IMG_CACHE_MAX = 300
/** Asset entries kept — bounds pile-up of pre-deploy hashed chunks. */
const ASSET_CACHE_MAX = 80

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
        Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

/** Cache-first with insertion-order trim. Only successful responses are kept. */
async function cacheFirst(req, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) {
    await cache.put(req, res.clone())
    const keys = await cache.keys()
    if (keys.length > maxEntries) {
      await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)))
    }
  }
  return res
}

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    /* non-JSON push — show the fallback below */
  }
  const n = payload.notification || {}
  event.waitUntil(
    self.registration.showNotification(n.title || 'Ovoid', {
      body: n.body || '',
      tag: n.tag || undefined,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { navigate: n.navigate || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.navigate) || '/'
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const win = wins.find((c) => c.url.startsWith(self.location.origin))
      if (win) {
        await win.focus()
        // In-app navigation (no reload): RootLayout listens for this message.
        win.postMessage({ type: 'navigate', url })
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  // Document navigations: network-first (always fresh), offline shell fallback.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')))
    return
  }

  const url = new URL(req.url)

  // Hashed build assets — immutable by construction.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req, ASSET_CACHE, ASSET_CACHE_MAX))
    return
  }

  // Bluesky image CDN — content-addressed blobs.
  if (url.hostname === 'cdn.bsky.app') {
    event.respondWith(cacheFirst(req, IMG_CACHE, IMG_CACHE_MAX))
    return
  }
})
