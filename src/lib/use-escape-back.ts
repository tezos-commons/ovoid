import { useEffect } from 'react'
import { useArtifactStore } from '@/store/artifact-store'

/**
 * Desktop ESC = the Back gesture. The app already dismisses overlays one layer
 * at a time on browser Back / back-swipe — each open overlay pushes an
 * `{ overlay: true }` history sentinel via `useCloseOnBack`, and Back pops
 * exactly one. Desktop has no swipe, so ESC stands in for it.
 *
 * A single global listener takes one back-step per press, so stacked overlays
 * (e.g. an interactive artifact over the NFT browser) peel off one at a time
 * rather than all collapsing. Overlays therefore must NOT bind their own
 * ESC-to-close; doing so would fire every layer at once and desync history.
 *
 * Resolution order:
 *   1. Typing in a field → ignore (the field owns ESC, e.g. clearing search).
 *   2. A fullscreen interactive artifact is the top layer but holds no history
 *      entry of its own, so close it directly (revealing the browser beneath).
 *   3. Top history entry is an overlay sentinel → history.back() pops one layer.
 *   4. Otherwise (plain route, or a popover/dialog that manages its own ESC) →
 *      do nothing; we don't navigate routes on ESC.
 */
export function useEscapeBack(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return

      const art = useArtifactStore.getState()
      if (art.mode === 'full') {
        art.close()
        return
      }
      if (window.history.state?.overlay) window.history.back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
