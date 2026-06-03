import { useQuery } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Detailed profile for an actor (handle or DID). Public-capable: when signed out
 * this resolves through the public AppView; viewer-state fields (following /
 * blocking / muted) are simply absent in that case.
 *
 * Keyed by actor only (no viewer DID) per the qk contract for profile reads.
 * The viewer-state inside ProfileViewDetailed is still viewer-correct because
 * the authed agent carries the session; switching accounts replaces the agent
 * and React Query re-runs against the new identity on next mount/focus. We do
 * NOT fold did into the key to keep handle-based links shareable across the app.
 */
export function useProfile(actor: string | undefined) {
  const { agent } = useAgent()
  return useQuery<AppBskyActorDefs.ProfileViewDetailed>({
    queryKey: qk.profile(actor ?? ''),
    enabled: !!actor,
    queryFn: async () => {
      const res = await agent.app.bsky.actor.getProfile({ actor: actor! })
      return res.data
    },
  })
}
