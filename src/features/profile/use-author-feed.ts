import { useInfiniteQuery, infiniteQueryOptions } from '@tanstack/react-query'
import type { Agent, AppBskyFeedGetAuthorFeed } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * The getAuthorFeed `filter` values that map to profile tabs. `includePins`
 * surfaces the author's pinned post at the top of the default Posts tab.
 */
export type AuthorFeedFilter =
  | 'posts_no_replies'
  | 'posts_with_replies'
  | 'posts_with_media'
  | 'posts_and_author_threads'

type Page = AppBskyFeedGetAuthorFeed.OutputSchema

/** Shared infinite-query config for a filtered author feed (hook + prefetch). */
export function authorFeedOptions(
  agent: Agent,
  did: string | undefined,
  actor: string,
  filter: AuthorFeedFilter,
) {
  return infiniteQueryOptions<Page>({
    queryKey: qk.authorFeed(did, actor, filter),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.feed.getAuthorFeed({
        actor,
        filter,
        includePins: filter === 'posts_no_replies',
        limit: 30,
        cursor: pageParam as string | undefined,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/**
 * Filter-aware author feed. One cache entry per (actor, filter) so the Posts /
 * Replies / Media tabs each keep their own scroll + pages. Cursor='' is
 * normalized to undefined so pagination terminates cleanly.
 */
export function useAuthorFeed(
  actor: string | undefined,
  filter: AuthorFeedFilter,
  opts?: { enabled?: boolean },
) {
  const { agent, did } = useAgent()
  return useInfiniteQuery({
    ...authorFeedOptions(agent, did, actor ?? '', filter),
    enabled: !!actor && opts?.enabled !== false,
  })
}
