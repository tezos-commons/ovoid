import { useLayoutEffect } from 'react'
import { useNavigationType } from 'react-router-dom'

/**
 * Remembered document scroll offsets, keyed by a stable id. Module-level so it
 * survives a component's unmount; page-session lifetime only (never serialized).
 * The virtualized lists keep their own (offset + measurement) memory in
 * InfiniteList — this is the plain-window analogue for document-scrolling
 * screens like the profile feeds.
 */
const windowScrollMemory = new Map<string, number>()

/**
 * Saved offset for a key (undefined when none). For window-virtualized lists
 * that must seed `initialOffset` consistently with what
 * useWindowScrollRestoration will scroll to: a virtualizer constructed with
 * its default initialOffset (the CURRENT window.scrollY, i.e. the PREVIOUS
 * screen's depth) believes items sit above the viewport and its
 * scroll-anchoring (resizeItem → applyScrollAdjustment) yanks the window
 * back toward that stale offset after the navigation reset.
 */
export function getSavedWindowScroll(key: string | undefined): number | undefined {
  return key ? windowScrollMemory.get(key) : undefined
}

/**
 * Remember and restore the window scroll position for a document-scrolling
 * screen across unmount/remount (e.g. a profile feed → open a post → back).
 *
 * Pass a stable key; `undefined` disables it. On mount it restores the saved
 * offset — but ONLY on back/forward (POP) navigation, mirroring RootLayout's
 * reset contract. A forward navigation (PUSH/REPLACE) always starts at the
 * top: this screen can mount LATE (a loading skeleton resolved), i.e. after
 * RootLayout's pathname-keyed reset already ran, so an unconditional restore
 * here would override that reset with a stale offset from a previous visit.
 * Mount-only restore (keyed by `key`): re-applying mid-life would fight the
 * user's own scrolling.
 *
 * Caveat: restoration is exact only when the content is already tall enough at
 * mount (the feed's React Query page is warm, which it is on a quick back). If
 * the page must refetch from empty, the screen is short when this runs and the
 * offset clamps toward the top.
 */
export function useWindowScrollRestoration(key: string | undefined): void {
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    if (!key) return
    const saved = navigationType === 'POP' ? windowScrollMemory.get(key) : undefined
    window.scrollTo(0, saved ?? 0)
    const onScroll = () => windowScrollMemory.set(key, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      windowScrollMemory.set(key, window.scrollY)
      window.removeEventListener('scroll', onScroll)
    }
  }, [key])
}
