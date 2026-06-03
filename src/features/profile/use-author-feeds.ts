import { useInfiniteQuery } from '@tanstack/react-query'
import type {
  AppBskyFeedGetActorFeeds,
  AppBskyGraphGetLists,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Feed generators authored by an actor (the profile "Feeds" tab). Distinct from
 * the viewer's saved feeds — these are records the actor created. Keyed under
 * myFeeds(actor) so it doesn't collide with the viewer's pinned-feed cache.
 */
export function useAuthorFeeds(actor: string | undefined, opts?: { enabled?: boolean }) {
  const { agent } = useAgent()
  return useInfiniteQuery<AppBskyFeedGetActorFeeds.OutputSchema>({
    queryKey: [...qk.myFeeds(actor), 'authored'] as const,
    enabled: !!actor && opts?.enabled !== false,
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

/**
 * Lists owned by an actor (the profile "Lists" tab). getLists returns curate /
 * mod / reference lists; the screen renders them all with their purpose chip.
 */
export function useAuthorLists(actor: string | undefined, opts?: { enabled?: boolean }) {
  const { agent } = useAgent()
  return useInfiniteQuery<AppBskyGraphGetLists.OutputSchema>({
    queryKey: qk.lists(actor ?? ''),
    enabled: !!actor && opts?.enabled !== false,
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
