import { useInfiniteQuery } from '@tanstack/react-query'
import type { AppBskyFeedGetActorLikes } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type Page = AppBskyFeedGetActorLikes.OutputSchema

/**
 * A user's Likes feed. The AppView only serves this for the authed viewer's own
 * actor — getActorLikes 403s for anyone else — so callers must gate it to
 * self-profiles. `enabled` lets the screen mount the hook conditionally.
 */
export function useActorLikes(actor: string | undefined, opts?: { enabled?: boolean }) {
  const { agent, did } = useAgent()
  return useInfiniteQuery<Page>({
    queryKey: qk.actorLikes(did, actor ?? ''),
    enabled: !!actor && opts?.enabled !== false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.feed.getActorLikes({
        actor: actor!,
        limit: 30,
        cursor: pageParam as string | undefined,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}
