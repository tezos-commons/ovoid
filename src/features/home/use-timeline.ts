import { useInfiniteQuery, infiniteQueryOptions } from '@tanstack/react-query'
import type { Agent, AppBskyFeedGetTimeline } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { MAX_FEED_PAGES } from '@/lib/query-client'
import { qk } from '@/lib/query-keys'

type Page = AppBskyFeedGetTimeline.OutputSchema

const PAGE_LIMIT = 30

/** Shared infinite-query config for the Following timeline (hook + prefetch). */
export function timelineOptions(agent: Agent, did: string | undefined) {
  return infiniteQueryOptions({
    queryKey: qk.timeline(did),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<Page> => {
      const res = await agent.app.bsky.feed.getTimeline({
        cursor: pageParam,
        limit: PAGE_LIMIT,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
    maxPages: MAX_FEED_PAGES,
    // Never auto-refetch a cached feed on (re)mount — returning from a post must
    // show the feed exactly as left, not reflow it. Cold queries still fetch;
    // freshness comes from a deliberate refresh, not navigation.
    refetchOnMount: false,
  })
}

/**
 * The Following timeline. Cursor pagination via useInfiniteQuery.
 *
 * Invariant: getNextPageParam normalises an empty-string cursor to undefined so
 * the list correctly reports end-of-feed (atproto returns '' at the tail for
 * some feeds, which is truthy-empty and would otherwise loop).
 */
export function useTimeline(enabled = true) {
  const { agent, did } = useAgent()
  return useInfiniteQuery({ ...timelineOptions(agent, did), enabled })
}
