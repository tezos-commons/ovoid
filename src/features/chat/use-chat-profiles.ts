import { useQuery } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

export type ProfileMap = Map<string, AppBskyActorDefs.ProfileViewDetailed>

/**
 * Resolve a set of DIDs to profiles via app.bsky.actor.getProfiles. Used to name
 * accounts that appear in a chat (system-message subjects, message senders) but
 * aren't in the partial `convo.members` set — e.g. someone who just joined via
 * an invite link, who otherwise renders as a raw DID. Goes through the regular
 * AppView agent (not the chat proxy); cached under the shared profiles-bulk key.
 */
export function useChatProfiles(dids: string[]): ProfileMap {
  const { agent } = useAgent()
  const sorted = [...new Set(dids)].sort()
  const query = useQuery({
    queryKey: qk.profilesBulk(sorted.join(',')),
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const byDid: ProfileMap = new Map()
      for (let i = 0; i < sorted.length; i += 25) {
        const chunk = sorted.slice(i, i + 25)
        const res = await agent.app.bsky.actor.getProfiles({ actors: chunk })
        for (const p of res.data.profiles) byDid.set(p.did, p)
      }
      return byDid
    },
  })
  return query.data ?? EMPTY
}

const EMPTY: ProfileMap = new Map()
