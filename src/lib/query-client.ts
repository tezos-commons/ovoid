import { QueryClient, type QueryKey } from '@tanstack/react-query'
import {
  experimental_createQueryPersister,
  type PersistedQuery,
} from '@tanstack/query-persist-client-core'
import { idbStorage, clearIdbStorage } from './idb-storage'

/**
 * Single shared QueryClient. React Query is the sole server-state cache.
 *
 * staleTime 30s   — feeds/profiles stay fresh enough without hammering the PDS.
 * gcTime 5m       — keep unused data around for quick back-navigation.
 * retry 1         — XRPC errors are usually deterministic (auth/ratelimit); one retry.
 * refetchOnWindowFocus false — avoids surprise refetches that jolt the feed scroll.
 */
/**
 * Page cap for feed-family infinite queries. Bounds two things that otherwise
 * grow with scroll depth: cache memory, and the sequential all-pages replay an
 * infinite query performs when invalidated or refetched stale. 20 pages ≈ 600
 * posts — past the cap the head page is evicted, which only a pathological
 * scroll-back session would notice.
 */
export const MAX_FEED_PAGES = 20

/**
 * Don't write fast-moving or session-scoped reads to disk: chat (polled at
 * seconds-granularity, and the most privacy-sensitive data we hold), the
 * unread badge (poll-driven), search/typeahead (only meaningful within the
 * session that typed them), and polls (live vote tallies + per-viewer state).
 * Everything else — feeds, profiles, threads, notifications, preferences,
 * tezos/objkt metadata — persists.
 */
function shouldPersist(queryKey: QueryKey): boolean {
  return !queryKey.some(
    (part) =>
      part === 'chat' ||
      part === 'unread' ||
      part === 'search' ||
      part === 'poll',
  )
}

/**
 * Per-query IndexedDB persistence. Restore is per-key and lazy: a query whose
 * memory cache is empty resolves from disk first (instantly, off the critical
 * path) and — because the restored dataUpdatedAt is preserved — refetches in
 * the background per normal staleTime rules. Pure SWR; the warming code needs
 * no changes.
 *
 * serialize nulls the error fields: XRPC error instances aren't structured-
 * cloneable, and a failed background refetch must not poison the disk entry.
 * Bump `buster` on any breaking change to cached data shapes.
 */
const persister = experimental_createQueryPersister<PersistedQuery>({
  storage: idbStorage,
  serialize: (pq) => ({
    ...pq,
    state: { ...pq.state, error: null, fetchFailureReason: null },
  }),
  deserialize: (pq) => pq,
  maxAge: 24 * 60 * 60 * 1000,
  // v3: collection metadata gained a `creator` field (and v2 proxied the
  // ipfs:// logo); drop older entries so both populate on next load.
  buster: 'v3',
  prefix: 'ovoid',
  filters: { predicate: (query) => shouldPersist(query.queryKey) },
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      persister: persister.persisterFn,
    },
    mutations: {
      retry: 0,
    },
  },
})

/** Prune expired/busted disk entries. Run once per session, on idle. */
export function gcPersistedQueries(): Promise<void> {
  return persister.persisterGc().catch(() => {})
}

/** Wipe both cache layers — memory and disk. Call on sign-out. */
export function clearAllCaches(): Promise<void> {
  queryClient.clear()
  return clearIdbStorage()
}
