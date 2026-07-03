import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import type { Agent, AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

export type PostSort = 'top' | 'latest'

interface SearchPostsPage {
  posts: AppBskyFeedDefs.PostView[]
  cursor?: string
  hitsTotal?: number
}

/**
 * app.bsky.feed.searchPosts as an infinite query — shared by the hook and the
 * SearchScreen sibling-tab warmer. `term` must be pre-trimmed. `sort`
 * participates in the cache key so Top and Latest are distinct caches. Cursor
 * is normalized: an empty string from the AppView means end-of-list.
 */
export function searchPostsOptions(agent: Agent, term: string, sort: PostSort, isAuthed: boolean) {
  return infiniteQueryOptions({
    queryKey: qk.searchPosts(term, sort),
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.feed.searchPosts({
        q: term,
        sort,
        limit: 25,
        cursor: pageParam,
      })
      return res.data as SearchPostsPage
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    // Authed search returns viewer state (your like/repost); public works too.
    staleTime: isAuthed ? 30_000 : 60_000,
  })
}

/**
 * The query is enabled only for a non-empty trimmed term; an empty term must
 * not fire a request (the screen renders the discover empty-state instead).
 */
export function useSearchPosts(q: string, sort: PostSort) {
  const { agent, isAuthed } = useAgent()
  const term = q.trim()

  return useInfiniteQuery({
    ...searchPostsOptions(agent, term, sort, isAuthed),
    enabled: term.length > 0,
  })
}
