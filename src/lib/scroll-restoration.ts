import { useLayoutEffect } from 'react'

/**
 * Remembered document scroll offsets, keyed by a stable id. Module-level so it
 * survives a component's unmount; page-session lifetime only (never serialized).
 * The virtualized lists keep their own (offset + measurement) memory in
 * InfiniteList — this is the plain-window analogue for document-scrolling
 * screens like the profile feeds.
 */
const windowScrollMemory = new Map<string, number>()

/**
 * Remember and restore the window scroll position for a document-scrolling
 * screen across unmount/remount (e.g. a profile feed → open a post → back).
 *
 * Pass a stable key; `undefined` disables it. On mount it restores the saved
 * offset, or scrolls to the top when the key is new — so a freshly opened
 * profile/tab starts at the top rather than inheriting the previous route's
 * scroll. Mount-only restore (keyed by `key`): re-applying mid-life would fight
 * the user's own scrolling.
 *
 * Caveat: restoration is exact only when the content is already tall enough at
 * mount (the feed's React Query page is warm, which it is on a quick back). If
 * the page must refetch from empty, the screen is short when this runs and the
 * offset clamps toward the top.
 */
export function useWindowScrollRestoration(key: string | undefined): void {
  useLayoutEffect(() => {
    if (!key) return
    const saved = windowScrollMemory.get(key)
    window.scrollTo(0, saved ?? 0)
    const onScroll = () => windowScrollMemory.set(key, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      windowScrollMemory.set(key, window.scrollY)
      window.removeEventListener('scroll', onScroll)
    }
  }, [key])
}
