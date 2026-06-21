import { useInfiniteQuery, infiniteQueryOptions } from '@tanstack/react-query'
import type { Agent, AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { MAX_FEED_PAGES } from '@/lib/query-client'
import { qk } from '@/lib/query-keys'

type Page = { feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string }

const PAGE_LIMIT = 30

/**
 * Shared infinite-query config for a pinned custom feed / list, consumed by both
 * `useCustomFeed` and the home-strip prefetcher. Keyed by (did, uri) exactly as
 * the active-tab hook is, so a prefetch warms the entry the tab will render.
 */
export function customFeedOptions(
  agent: Agent,
  did: string | undefined,
  uri: string,
  kind: 'feed' | 'list' = 'feed',
) {
  return infiniteQueryOptions({
    queryKey: qk.feed(did, uri),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<Page> => {
      if (kind === 'list') {
        const res = await agent.app.bsky.feed.getListFeed({
          list: uri,
          cursor: pageParam,
          limit: PAGE_LIMIT,
        })
        return res.data
      }
      const res = await agent.app.bsky.feed.getFeed({
        feed: uri,
        cursor: pageParam,
        limit: PAGE_LIMIT,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
    maxPages: MAX_FEED_PAGES,
    // Never auto-refetch a cached feed on (re)mount — returning from a post must
    // show the feed exactly as left, not reflow it. Cold queries still fetch.
    refetchOnMount: false,
  })
}

/**
 * The timeline behind a pinned Home tab. The source endpoint depends on the
 * tab's kind:
 *   - 'feed' -> app.bsky.feed.getFeed({ feed }) for a feed generator AT-URI.
 *   - 'list' -> app.bsky.feed.getListFeed({ list }) for a list AT-URI. getFeed
 *     does NOT serve lists (it returns "could not find feed"); getListFeed is
 *     the correct surface for posts authored by a list's members.
 *
 * Both return the same { feed, cursor } page shape. `enabled` lets the screen
 * mount exactly one feed query at a time (the active tab).
 */
export function useCustomFeed(
  uri: string | undefined,
  kind: 'feed' | 'list' = 'feed',
  enabled = true,
) {
  const { agent, did } = useAgent()
  return useInfiniteQuery({
    ...customFeedOptions(agent, did, uri ?? '', kind),
    enabled: enabled && !!uri,
  })
}
