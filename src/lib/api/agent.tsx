import { useMemo } from 'react'
import type { Agent } from '@atproto/api'
import { makePublicAgent } from './public-agent'
import { useAuth, getAuthSnapshot, type AuthContextValue } from './auth-context'

// Re-export the session layer so `@/lib/api/agent` stays the single public
// surface — features import useAgent/useAuth/AuthProvider from one place.
export { AuthProvider, useAuth } from './auth-context'
export type { AuthState, AuthContextValue } from './auth-context'
export type { StoredAccount } from '../auth/accounts'

/* ============================================================
   Agent bundle — the ONLY way features touch the network.
   ============================================================ */

export interface AgentBundle {
  /** Authed OAuth agent, or a public Agent when signed out. */
  agent: Agent
  /** Chat-proxied agent; null when signed out. */
  chatAgent: Agent | null
  did: string | undefined
  handle: string | undefined
  /** Viewer's avatar URL, hydrated from the profile after sign-in. */
  avatar: string | undefined
  isAuthed: boolean
}

// A shared public agent so signed-out reads don't allocate per render.
let _publicAgent: Agent | null = null
function publicAgent(): Agent {
  if (!_publicAgent) _publicAgent = makePublicAgent()
  return _publicAgent
}

function bundleFromAuth(auth: AuthContextValue): AgentBundle {
  if (auth.state.status === 'signedIn') {
    return {
      agent: auth.state.agent,
      chatAgent: auth.state.chatAgent,
      did: auth.state.did,
      handle: auth.state.handle,
      avatar: auth.state.avatar,
      isAuthed: true,
    }
  }
  return {
    agent: publicAgent(),
    chatAgent: null,
    did: undefined,
    handle: undefined,
    avatar: undefined,
    isAuthed: false,
  }
}

/** Hook used by every read/mutation hook. NEVER construct an Agent in a feature. */
export function useAgent(): AgentBundle {
  const auth = useAuth()
  return useMemo(() => bundleFromAuth(auth), [auth.state])
}

/* ------------------------------------------------------------
   Non-hook accessor for loaders / one-off imperative calls.
   Mirrors the latest provider value; throws if provider unmounted.
   ------------------------------------------------------------ */
export function getAgent(): AgentBundle {
  const snapshot = getAuthSnapshot()
  if (!snapshot) {
    throw new Error('getAgent() called before <AuthProvider> mounted')
  }
  return bundleFromAuth(snapshot)
}
