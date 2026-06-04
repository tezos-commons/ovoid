import { useEffect, useRef } from 'react'

/**
 * Dwell before firing: an element must stay intersecting this long before its
 * prefetch runs. Keeps a fast scroll-through from spraying one prefetch per row
 * it flies past — only links the eye actually rests near get warmed.
 */
const DWELL_MS = 250

/**
 * Returns a ref. When the referenced element has been within (or near) the
 * viewport for DWELL_MS, `onVisible` fires exactly once, then the observer
 * disconnects — a link is only ever prefetched once per mount.
 *
 * `rootMargin` pulls the trigger 200px before the element scrolls into view, so
 * the fetch is usually done by the time the user reaches and clicks it. Feeds
 * are virtualized, so only on-screen rows are mounted — the set of live
 * observers stays naturally small.
 */
export function usePrefetchOnVisible<T extends Element>(onVisible: () => void) {
  const ref = useRef<T | null>(null)
  const fired = useRef(false)
  // Keep the latest callback without re-running the observer effect.
  const cb = useRef(onVisible)
  cb.current = onVisible

  useEffect(() => {
    const el = ref.current
    if (!el || fired.current) return

    let timer: number | undefined
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          timer = window.setTimeout(() => {
            if (!fired.current) {
              fired.current = true
              cb.current()
            }
            io.disconnect()
          }, DWELL_MS)
        } else if (timer !== undefined) {
          clearTimeout(timer)
          timer = undefined
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [])

  return ref
}
