import { useQuery } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Resolve the viewer's own detailed profile for the Account screen.
 *
 * The auth context seeds `handle` with the DID until a profile load fills it,
 * so we fetch ProfileViewDetailed here to show the real handle, display name,
 * avatar and counts. Keyed by actor (the DID) via the public qk.profile key.
 */
export function useAccount() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery<AppBskyActorDefs.ProfileViewDetailed | undefined>({
    queryKey: qk.profile(did ?? ''),
    enabled: isAuthed && !!did,
    queryFn: async () => {
      if (!did) return undefined
      const res = await agent.app.bsky.actor.getProfile({ actor: did })
      return res.data
    },
    staleTime: 60_000,
  })
}

/**
 * Session transport descriptor for the "App password / OAuth session" row.
 *
 * Frontend-only OAuth: the OAuthSession owns DPoP-bound tokens in IndexedDB and
 * refreshes them transparently — there is no app-password / JWT to surface, and
 * the library exposes no scope getter on the session in this version. We report
 * what is knowable: that this is an OAuth (DPoP) session and the bound DID.
 */
export interface SessionInfo {
  kind: 'oauth' | 'unknown'
  did: string | undefined
  tokenBinding: 'dpop'
  storage: 'IndexedDB'
}

export function useSessionInfo(): SessionInfo {
  const { did, isAuthed } = useAgent()
  return {
    kind: isAuthed ? 'oauth' : 'unknown',
    did,
    tokenBinding: 'dpop',
    storage: 'IndexedDB',
  }
}
