import { QueryClient } from '@tanstack/react-query'

/**
 * Single shared QueryClient. React Query is the sole server-state cache.
 *
 * staleTime 30s   — feeds/profiles stay fresh enough without hammering the PDS.
 * gcTime 5m       — keep unused data around for quick back-navigation.
 * retry 1         — XRPC errors are usually deterministic (auth/ratelimit); one retry.
 * refetchOnWindowFocus false — avoids surprise refetches that jolt the feed scroll.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
