import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { followTezos, isFollowingTezos } from '@/lib/graph/client'

// Follow state changes only when the viewer acts (and we patch the cache then),
// so a modest stale window is plenty.
const FOLLOW_STALE = 60_000

export function followingTezosOptions(agent: Agent, viewerDid: string | undefined, address: string) {
  return queryOptions({
    queryKey: qk.graphFollowingTezos(viewerDid, address),
    queryFn: () => isFollowingTezos(agent, address),
    staleTime: FOLLOW_STALE,
  })
}

/** Whether the signed-in viewer follows `address` (graph.ovoid.at). */
export function useIsFollowingTezos(address: string) {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...followingTezosOptions(agent, did, address),
    enabled: isAuthed && !!address,
  })
}

/** Follow a Tezos address. Idempotent server-side; patches the follow-state cache. */
export function useFollowTezos(address: string) {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => followTezos(agent, address),
    onSuccess: () => {
      qc.setQueryData(qk.graphFollowingTezos(did, address), true)
    },
  })
}
