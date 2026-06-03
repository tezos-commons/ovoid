import { useInfiniteQuery } from '@tanstack/react-query'
import type {
  AppBskyGraphGetFollows,
  AppBskyGraphGetFollowers,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type FollowsPage = AppBskyGraphGetFollows.OutputSchema
type FollowersPage = AppBskyGraphGetFollowers.OutputSchema

/** Accounts `actor` follows. */
export function useFollows(actor: string | undefined, opts?: { enabled?: boolean }) {
  const { agent } = useAgent()
  return useInfiniteQuery<FollowsPage>({
    queryKey: qk.follows(actor ?? ''),
    enabled: !!actor && opts?.enabled !== false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.graph.getFollows({
        actor: actor!,
        limit: 30,
        cursor: pageParam as string | undefined,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/** Accounts that follow `actor`. */
export function useFollowers(actor: string | undefined, opts?: { enabled?: boolean }) {
  const { agent } = useAgent()
  return useInfiniteQuery<FollowersPage>({
    queryKey: qk.followers(actor ?? ''),
    enabled: !!actor && opts?.enabled !== false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.graph.getFollowers({
        actor: actor!,
        limit: 30,
        cursor: pageParam as string | undefined,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}
