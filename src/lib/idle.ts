/**
 * Run `fn` when the main thread is idle, returning a canceller. Falls back to a
 * short timeout where requestIdleCallback is unavailable (Safari). Used to defer
 * speculative prefetch so it never competes with a screen's own first paint.
 */
export function runWhenIdle(fn: () => void): () => void {
  const ric = (window as typeof window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }).requestIdleCallback
  if (ric) {
    const id = ric(fn, { timeout: 2000 })
    return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, 200)
  return () => clearTimeout(id)
}
