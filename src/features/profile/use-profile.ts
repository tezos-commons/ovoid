import { useQuery, queryOptions } from '@tanstack/react-query'
import type { Agent, AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { findCachedProfileBasic } from '@/lib/feed-cache'
import { queryClient } from '@/lib/query-client'
import { qk } from '@/lib/query-keys'

/**
 * Shared query config for a detailed profile, consumed by both `useProfile` and
 * the visibility prefetcher. `actor` is a handle or DID; the key matches the
 * link's actor string so a prefetch warms the exact entry the route will read.
 */
export function profileOptions(agent: Agent, actor: string) {
  return queryOptions<AppBskyActorDefs.ProfileViewDetailed>({
    queryKey: qk.profile(actor),
    // A ProfileViewBasic from a cached feed is a structural subset of the
    // detailed view (counts/banner are optional and formatters tolerate their
    // absence), so the header paints instantly; the fetch fills in the rest.
    // $type is dropped — it's the one field where the views differ, and the
    // placeholder must not masquerade as a basic view to discriminators.
    // Observer-only — never persisted to the cache.
    placeholderData: (): AppBskyActorDefs.ProfileViewDetailed | undefined => {
      const basic = findCachedProfileBasic(actor)
      if (!basic) return undefined
      const { $type: _drop, ...rest } = basic
      return rest
    },
    queryFn: async () => {
      const res = await agent.app.bsky.actor.getProfile({ actor })
      // The same profile is reachable by handle (post-header links) and by DID
      // (mention facets). Seed the counterpart key so whichever identifier the
      // next link uses, the entry is already warm — one fetch, both aliases.
      for (const alias of [res.data.did, res.data.handle]) {
        if (alias && alias !== actor && alias !== 'handle.invalid') {
          queryClient.setQueryData(qk.profile(alias), res.data)
        }
      }
      return res.data
    },
  })
}

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
  return useQuery({
    ...profileOptions(agent, actor ?? ''),
    enabled: !!actor,
  })
}
