import { useEffect, useRef } from 'react'

/**
 * Make the browser/device Back button (and back-swipe) dismiss an overlay
 * instead of navigating the route.
 *
 * While `open`, a sentinel history entry is pushed (same URL, so react-router's
 * own popstate handling is a no-op). A popstate (Back) calls `close`; a close
 * via the UI (button / ESC / backdrop) consumes the entry with history.back(),
 * keeping history balanced. `close` is read through a ref so an inline callback
 * doesn't re-run the effect — the effect depends only on `open`.
 *
 * StrictMode safety: on a conditionally-mounted overlay React (dev) runs the
 * mount effect setup→cleanup→setup synchronously. A naive cleanup that calls
 * history.back() immediately would fire a popstate that the *re-registered*
 * listener from the second setup catches, instantly closing the overlay. So the
 * cleanup's consume is *deferred* via a timer held in a ref; a synchronous
 * re-setup cancels the pending consume and reuses the existing sentinel instead
 * of pushing a second one. A real unmount lets the timer fire and balance.
 */
export function useCloseOnBack(open: boolean, close: () => void): void {
  const closeRef = useRef(close)
  closeRef.current = close
  // Pending deferred history.back() (sentinel consume), shared across effect runs
  // of this hook instance so a StrictMode re-setup can cancel it.
  const pendingConsume = useRef<number | null>(null)
  // URL when the sentinel was pushed; lets cleanup tell an in-place close from a
  // forward navigation that happened while open.
  const sentinelHref = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (pendingConsume.current !== null) {
      // A just-run cleanup scheduled a consume (StrictMode remount or fast
      // re-open): cancel it and reuse the sentinel that's still on the stack.
      clearTimeout(pendingConsume.current)
      pendingConsume.current = null
    } else {
      window.history.pushState({ ...window.history.state, overlay: true }, '')
      sentinelHref.current = window.location.href
    }

    let closedByBack = false
    const onPopState = () => {
      closedByBack = true
      closeRef.current()
    }
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      if (closedByBack) return // user Back already popped the sentinel
      // If the app navigated to a different URL while open (e.g. a link inside the
      // overlay), the sentinel is now buried under the new entry — a balancing
      // history.back() would UNDO that navigation. Leave the sentinel be.
      if (sentinelHref.current !== null && window.location.href !== sentinelHref.current) {
        sentinelHref.current = null
        return
      }
      // Defer so a synchronous StrictMode re-setup can cancel this; on a real
      // close/unmount nothing cancels it and the sentinel is consumed next tick.
      pendingConsume.current = window.setTimeout(() => {
        pendingConsume.current = null
        window.history.back()
      }, 0)
    }
  }, [open])
}
