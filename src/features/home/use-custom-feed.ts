import { useInfiniteQuery } from '@tanstack/react-query'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type Page = { feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string }

const PAGE_LIMIT = 30

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
    queryKey: qk.feed(did, uri ?? ''),
    enabled: enabled && !!uri,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<Page> => {
      if (kind === 'list') {
        const res = await agent.app.bsky.feed.getListFeed({
          list: uri as string,
          cursor: pageParam,
          limit: PAGE_LIMIT,
        })
        return res.data
      }
      const res = await agent.app.bsky.feed.getFeed({
        feed: uri as string,
        cursor: pageParam,
        limit: PAGE_LIMIT,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}
