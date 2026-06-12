import { useQuery } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { profileOptions } from '@/features/profile/use-profile'

/**
 * Resolve the viewer's own detailed profile for the Account screen.
 *
 * The auth context seeds `handle` with the DID until a profile load fills it,
 * so we fetch ProfileViewDetailed here to show the real handle, display name,
 * avatar and counts. Consumes profileOptions — the SAME factory (and thus the
 * same qk.profile(did) entry) that useWarmNavDestinations warms for the
 * Profile nav item, so settings always lands on a warm cache.
 */
export function useAccount() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...profileOptions(agent, did ?? ''),
    enabled: isAuthed && !!did,
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
