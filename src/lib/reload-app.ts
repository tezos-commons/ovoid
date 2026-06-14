/**
 * Force the PWA to pick up a fresh deploy. A plain reload can keep running the
 * old build: the service worker serves content-hashed /assets/* cache-first and
 * an installed (standalone) PWA holds onto the active SW. So we unregister every
 * SW and drop all Cache Storage entries, then reload — the next load re-fetches
 * index.html, the new hashed chunks, and re-registers the SW from scratch.
 *
 * Non-destructive: this only clears the asset/shell/image caches. Session and
 * the React Query IndexedDB cache are left intact.
 */
export async function reloadApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Best-effort: even if cache teardown fails, still reload below.
  }
  // Reload from the network. (The boolean arg is ignored by modern browsers but
  // harmless; unregistering the SW above is what actually defeats the cache.)
  window.location.reload()
}
