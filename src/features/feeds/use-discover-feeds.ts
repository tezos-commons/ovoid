import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'
import type { Agent, AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type GeneratorView = AppBskyFeedDefs.GeneratorView

/* ------------------------------------------------------------------ *
 * unspecced adapter
 *
 * app.bsky.unspecced.getPopularFeedGenerators is explicitly unstable and may
 * change shape or vanish. We isolate it behind this module so the rest of the
 * feature depends only on a stable `{ feeds, cursor }` contract. If the method
 * disappears we can swap the body for getSuggestedFeeds without touching the
 * screen.
 * ------------------------------------------------------------------ */

interface DiscoverPage {
  feeds: GeneratorView[]
  cursor?: string
}

async function fetchPopular(
  agent: Agent,
  params: { query?: string; cursor?: string; limit?: number },
): Promise<DiscoverPage> {
  const res = await agent.app.bsky.unspecced.getPopularFeedGenerators({
    query: params.query || undefined,
    cursor: params.cursor,
    limit: params.limit ?? 30,
  })
  return { feeds: res.data.feeds, cursor: res.data.cursor }
}

/**
 * Popular / searchable feed generators for the Discover section — shared by
 * the hook and the FeedsScreen sibling-tab warmer.
 * Paginated; `query` filters server-side (the search-within-feeds input).
 */
export function discoverFeedsOptions(agent: Agent, query: string) {
  const q = query.trim()
  return infiniteQueryOptions({
    // Not a viewer-scoped resource; this list is public and identical per query.
    queryKey: qk.discoverFeeds(q),
    queryFn: ({ pageParam }) =>
      fetchPopular(agent, { query: q, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    staleTime: 5 * 60_000,
  })
}

export function useDiscoverFeeds(query: string) {
  const { agent } = useAgent()
  return useInfiniteQuery(discoverFeedsOptions(agent, query))
}

/**
 * app.bsky.feed.getSuggestedFeeds — personalized suggestions for the signed-in
 * viewer (a short, non-paginated strip shown above Discover when authed).
 */
export function suggestedFeedsOptions(agent: Agent, did: string | undefined) {
  return queryOptions<GeneratorView[]>({
    queryKey: qk.suggestedFeeds(did),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await agent.app.bsky.feed.getSuggestedFeeds({ limit: 10 })
      return res.data.feeds
    },
  })
}

export function useSuggestedFeeds() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({ ...suggestedFeedsOptions(agent, did), enabled: isAuthed })
}
