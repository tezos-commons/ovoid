import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Agent } from '@atproto/api'
import type { OAuthSession } from '@atproto/oauth-client-browser'
import { getOAuthClient } from '../oauth/client'
import { clearAllCaches } from '../query-client'
import { bootstrap } from '../auth-bootstrap'
import { withChatProxy } from './proxy'
import { getPrefs, selectLabelerDids } from '../prefs'

/* ============================================================
   Auth context — the single source of session truth. The agent
   *bundle* layer (useAgent / getAgent) sits on top of this in
   ./agent; this module knows nothing about bundles.
   ============================================================ */

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | {
      status: 'signedIn'
      agent: Agent
      chatAgent: Agent
      session: OAuthSession
      did: string
      handle: string
      displayName?: string
      avatar?: string
    }

export interface AuthContextValue {
  state: AuthState
  session: OAuthSession | null
  did: string | undefined
  handle: string | undefined
  displayName: string | undefined
  avatar: string | undefined
  isLoading: boolean
  isAuthed: boolean
  /** Redirects the browser to the PDS authorize endpoint (Promise<never> on success). */
  signIn: (handle: string, opts?: { state?: string }) => Promise<void>
  /** Legacy app-password fallback. Optional; not all builds wire it. */
  signInWithAppPassword?: (identifier: string, appPassword: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/* ------------------------------------------------------------
   Resolve viewer identity from a session.
   ------------------------------------------------------------ */
function deriveIdentity(session: OAuthSession): { did: string; handle: string } {
  // OAuthSession exposes the DID; handle is resolved lazily via the agent.
  // We seed handle with the DID and let profile loads fill the display handle.
  const did = session.did
  return { did, handle: did }
}

function buildSignedIn(session: OAuthSession): Extract<AuthState, { status: 'signedIn' }> {
  const agent = new Agent(session)
  const chatAgent = withChatProxy(agent)
  const { did, handle } = deriveIdentity(session)
  return { status: 'signedIn', agent, chatAgent, session, did, handle }
}

/* ============================================================
   Provider
   ============================================================ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    // Restore any persisted session or consume the OAuth callback (one-shot).
    // A later refresh failure surfaces as an XRPC auth error on the next request
    // rather than via a global event — this client version exposes no session
    // event subscription.
    bootstrap()
      .then(async (result) => {
        if (cancelled) return
        if (result?.session) {
          const signedIn = buildSignedIn(result.session)
          // Subscribe the agent to the user's labelers BEFORE marking signed-in,
          // so the first feed/profile query already carries the accept-labelers
          // header and the AppView returns those labelers' labels. configureLabelers
          // mutates the instance in place; the same agent ref backs every hook.
          try {
            const dids = selectLabelerDids(await getPrefs(signedIn.agent))
            if (dids.length) signedIn.agent.configureLabelers(dids)
          } catch {
            /* prefs fetch failed — fall back to default labeler only; non-fatal */
          }
          if (cancelled) return
          setState(signedIn)
        } else {
          setState({ status: 'signedOut' })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'signedOut' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  // The session only carries the DID; handle was seeded with it. Hydrate the
  // real handle + display name + avatar from the profile once signed in. Deps
  // are (status, did) only, so the handle/displayName patch below does not
  // re-trigger this effect (no loop).
  const signedInDid = state.status === 'signedIn' ? state.did : undefined
  useEffect(() => {
    if (state.status !== 'signedIn') return
    let cancelled = false
    const { agent, did } = state
    agent.app.bsky.actor
      .getProfile({ actor: did })
      .then((res) => {
        if (cancelled) return
        setState((prev) =>
          prev.status === 'signedIn' && prev.did === res.data.did
            ? {
                ...prev,
                handle: res.data.handle,
                displayName: res.data.displayName,
                avatar: res.data.avatar,
              }
            : prev,
        )
      })
      .catch(() => {
        /* leave the DID-seeded handle; non-fatal */
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, signedInDid])

  const signIn = useCallback(async (handle: string, opts?: { state?: string }) => {
    const client = getOAuthClient()
    // Resolves on redirect failure; on success the browser navigates away.
    await client.signIn(handle, { state: opts?.state })
  }, [])

  const signOut = useCallback(async () => {
    const client = getOAuthClient()
    setState((prev) => {
      if (prev.status === 'signedIn') {
        void client.revoke(prev.did).catch(() => {})
      }
      return { status: 'signedOut' }
    })
    // Neither cache layer may outlive the session that filled it: profiles and
    // threads are keyed without the viewer DID but carry viewer state, so a
    // later account would inherit the previous viewer's data.
    void clearAllCaches()
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const isSignedIn = state.status === 'signedIn'
    return {
      state,
      session: isSignedIn ? state.session : null,
      did: isSignedIn ? state.did : undefined,
      handle: isSignedIn ? state.handle : undefined,
      displayName: isSignedIn ? state.displayName : undefined,
      avatar: isSignedIn ? state.avatar : undefined,
      isLoading: state.status === 'loading',
      isAuthed: isSignedIn,
      signIn,
      signOut,
    }
  }, [state, signIn, signOut])

  // Keep a module-level snapshot for getAgent() (loaders / imperative calls).
  _authSnapshot = value

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

/* ------------------------------------------------------------
   Module-level mirror of the latest provider value, for the
   non-hook accessor in ./agent (loaders / one-off calls).
   ------------------------------------------------------------ */
let _authSnapshot: AuthContextValue | null = null
export function getAuthSnapshot(): AuthContextValue | null {
  return _authSnapshot
}
