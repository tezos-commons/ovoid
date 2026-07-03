import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import type {
  Agent,
  AppBskyFeedGetActorFeeds,
  AppBskyGraphGetLists,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Feed generators authored by an actor (the profile "Feeds" tab) — shared by
 * the hook and ProfileScreen's sibling-tab warmer. Distinct from the viewer's
 * saved feeds — these are records the actor created. Keyed under
 * myFeeds(actor) so it doesn't collide with the viewer's pinned-feed cache.
 */
export function authorFeedsOptions(agent: Agent, actor: string | undefined) {
  return infiniteQueryOptions<AppBskyFeedGetActorFeeds.OutputSchema>({
    queryKey: [...qk.myFeeds(actor), 'authored'] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.feed.getActorFeeds({
        actor: actor!,
        limit: 30,
        cursor: pageParam as string | undefined,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

export function useAuthorFeeds(actor: string | undefined, opts?: { enabled?: boolean }) {
  const { agent } = useAgent()
  return useInfiniteQuery({
    ...authorFeedsOptions(agent, actor),
    enabled: !!actor && opts?.enabled !== false,
  })
}

/**
 * Lists owned by an actor (the profile "Lists" tab). getLists returns curate /
 * mod / reference lists; the screen renders them all with their purpose chip.
 */
export function authorListsOptions(agent: Agent, actor: string | undefined) {
  return infiniteQueryOptions<AppBskyGraphGetLists.OutputSchema>({
    queryKey: qk.lists(actor ?? ''),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.graph.getLists({
        actor: actor!,
        limit: 30,
        cursor: pageParam as string | undefined,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

export function useAuthorLists(actor: string | undefined, opts?: { enabled?: boolean }) {
  const { agent } = useAgent()
  return useInfiniteQuery({
    ...authorListsOptions(agent, actor),
    enabled: !!actor && opts?.enabled !== false,
  })
}
