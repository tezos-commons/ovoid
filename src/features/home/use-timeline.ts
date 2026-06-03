import { useInfiniteQuery } from '@tanstack/react-query'
import type { AppBskyFeedGetTimeline } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type Page = AppBskyFeedGetTimeline.OutputSchema

const PAGE_LIMIT = 30

/**
 * The Following timeline. Cursor pagination via useInfiniteQuery.
 *
 * Invariant: getNextPageParam normalises an empty-string cursor to undefined so
 * the list correctly reports end-of-feed (atproto returns '' at the tail for
 * some feeds, which is truthy-empty and would otherwise loop).
 */
export function useTimeline(enabled = true) {
  const { agent, did } = useAgent()

  return useInfiniteQuery({
    queryKey: qk.timeline(did),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<Page> => {
      const res = await agent.app.bsky.feed.getTimeline({
        cursor: pageParam,
        limit: PAGE_LIMIT,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}
