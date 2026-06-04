import type { QueryKey } from '@tanstack/react-query'

/**
 * Best-effort prefetch scheduler. A thin layer over queryClient.prefetch* whose
 * only jobs are to (a) bound concurrency so a scrolling feed can't fan out an
 * unbounded number of reads, (b) dedupe identical targets while one is queued
 * or in flight, and (c) stand down on data-saver / slow links.
 *
 * It deliberately does NOT cache or hash anything — React Query owns the cache.
 * `prefetchQuery`/`prefetchInfiniteQuery` already respect `staleTime` (fresh
 * data → no network) and dedupe concurrent fetches of the same key, so a prefetch
 * that races the real render is harmless. This scheduler just keeps the *queue*
 * tidy; once a job settles its key is released so a later visibility event can
 * re-warm it (which RQ will no-op if still fresh).
 */

const MAX_CONCURRENT = 8

let active = 0
const queue: Array<() => Promise<void>> = []
/** Keys currently queued or in flight — dedupe within a scroll session. */
const pending = new Set<string>()

/** Skip aggressive prefetch when the user has opted into data-saving / is on 2g. */
function networkAllowsPrefetch(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection
  if (!c) return true
  if (c.saveData) return false
  if (c.effectiveType && /(^|-)2g$/.test(c.effectiveType)) return false
  return true
}

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!
    active++
    void job().finally(() => {
      active--
      pump()
    })
  }
}

/**
 * Queue a prefetch. `key` is the React Query key of the target (used only for
 * dedupe); `run` performs the actual queryClient.prefetch* call. No-ops on
 * data-saver/2g or when the same key is already queued/in flight.
 */
export function schedulePrefetch(key: QueryKey, run: () => Promise<unknown>): void {
  if (!networkAllowsPrefetch()) return
  const id = JSON.stringify(key)
  if (pending.has(id)) return
  pending.add(id)
  queue.push(async () => {
    try {
      await run()
    } catch {
      // Prefetch is best-effort; swallow. The real render will surface errors.
    } finally {
      pending.delete(id)
    }
  })
  pump()
}
