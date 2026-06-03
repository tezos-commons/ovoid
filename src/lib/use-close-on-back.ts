import { useEffect, useRef } from 'react'

/**
 * Make the browser/device Back button (and back-swipe) dismiss an overlay
 * instead of navigating the route.
 *
 * While `open`, a sentinel history entry is pushed (same URL, so react-router's
 * own popstate handling is a no-op). A popstate (Back) calls `close`; a close
 * via the UI (button / ESC / backdrop) consumes the entry with history.back(),
 * keeping history balanced. `close` is read through a ref so an inline callback
 * doesn't re-run the effect (which would churn history entries every render) —
 * the effect depends only on `open`.
 */
export function useCloseOnBack(open: boolean, close: () => void): void {
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    if (!open) return
    window.history.pushState({ ...window.history.state, overlay: true }, '')
    let closedByBack = false
    const onPopState = () => {
      closedByBack = true
      closeRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if (!closedByBack) window.history.back()
    }
  }, [open])
}
