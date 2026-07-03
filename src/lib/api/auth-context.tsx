import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  getAccounts,
  upsertAccount,
  removeAccount as removeStoredAccount,
  getActiveDid,
  setActiveDid,
  type StoredAccount,
} from '../auth/accounts'

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
  /** Accounts registered on this device, in insertion order (switcher UI). */
  accounts: StoredAccount[]
  /** Redirects the browser to the PDS authorize endpoint (Promise<never> on success). */
  signIn: (handle: string, opts?: { state?: string }) => Promise<void>
  /** Legacy app-password fallback. Optional; not all builds wire it. */
  signInWithAppPassword?: (identifier: string, appPassword: string) => Promise<void>
  /**
   * Sign out of the CURRENT account only: revoke it, forget it, then fall
   * through to the next registered account (or the signed-out state).
   */
  signOut: () => Promise<void>
  /**
   * Restore another registered account's persisted session and make it the
   * active viewer. Rejects (and forgets the account) if the session is no
   * longer usable — the caller should offer the add-account flow.
   */
  switchAccount: (did: string) => Promise<void>
  /** Revoke + forget an account. For the active account this is signOut(). */
  removeAccount: (did: string) => Promise<void>
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
  const [accounts, setAccounts] = useState<StoredAccount[]>(getAccounts)

  // Current state for the imperative methods below (signOut/switchAccount are
  // stable callbacks; reading `state` from a closure would go stale).
  const stateRef = useRef(state)
  stateRef.current = state

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
          // The add-account OAuth callback boots as a DIFFERENT viewer than the
          // one that filled the persisted caches. Same invariant as signOut:
          // no cache entry may outlive the viewer whose session filled it
          // (profile/thread keys omit the viewer DID but carry viewer state).
          // Nothing has rendered yet (state is 'loading'), so awaiting the
          // purge here cannot race live queries.
          const prevDid = getActiveDid()
          if (prevDid && prevDid !== signedIn.did) await clearAllCaches()
          setActiveDid(signedIn.did)
          setAccounts(upsertAccount({ did: signedIn.did, handle: signedIn.handle }))
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
        // Authoritative registry entry: real handle + avatar for the switcher.
        setAccounts(
          upsertAccount({
            did: res.data.did,
            handle: res.data.handle,
            displayName: res.data.displayName,
            avatar: res.data.avatar,
          }),
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

  /**
   * Make a restored session the active viewer. Ordering mirrors the original
   * signOut: setState first, then purge both cache layers in the same tick —
   * the memory clear is synchronous, so the next render under the new viewer
   * starts from an empty cache. (Profiles and threads are keyed without the
   * viewer DID but carry viewer state, so no entry may survive the change.)
   */
  const activateSession = useCallback(async (session: OAuthSession) => {
    const signedIn = buildSignedIn(session)
    try {
      const dids = selectLabelerDids(await getPrefs(signedIn.agent))
      if (dids.length) signedIn.agent.configureLabelers(dids)
    } catch {
      /* default labeler only; non-fatal */
    }
    setActiveDid(signedIn.did)
    setAccounts(upsertAccount({ did: signedIn.did, handle: signedIn.handle }))
    setState(signedIn)
    void clearAllCaches()
  }, [])

  const switchAccount = useCallback(
    async (did: string) => {
      const cur = stateRef.current
      if (cur.status === 'signedIn' && cur.did === did) return
      const client = getOAuthClient()
      let session: OAuthSession
      try {
        // restore() also re-points the client's persisted current-sub marker,
        // so a reload after the switch boots into this account.
        session = await client.restore(did)
      } catch (err) {
        // Session no longer usable (refresh token expired / revoked upstream):
        // forget the account so the switcher stops offering it.
        setAccounts(removeStoredAccount(did))
        throw err
      }
      await activateSession(session)
    },
    [activateSession],
  )

  const signOut = useCallback(async () => {
    const cur = stateRef.current
    if (cur.status !== 'signedIn') return
    const client = getOAuthClient()
    void client.revoke(cur.did).catch(() => {})
    let remaining = removeStoredAccount(cur.did)
    setAccounts(remaining)
    // Fall through to the next registered account; skip any whose persisted
    // session turns out to be dead.
    for (const acc of remaining) {
      try {
        const session = await client.restore(acc.did)
        await activateSession(session)
        return
      } catch {
        remaining = removeStoredAccount(acc.did)
        setAccounts(remaining)
      }
    }
    setActiveDid(null)
    setState({ status: 'signedOut' })
    void clearAllCaches()
  }, [activateSession])

  const removeAccount = useCallback(
    async (did: string) => {
      const cur = stateRef.current
      if (cur.status === 'signedIn' && cur.did === did) return signOut()
      const client = getOAuthClient()
      void client.revoke(did).catch(() => {})
      setAccounts(removeStoredAccount(did))
      // The client's revoke() unconditionally clears its current-sub marker,
      // even when revoking a non-active account — re-point it at the active
      // session so a reload still restores it (refresh=false: store read only).
      if (cur.status === 'signedIn') void client.restore(cur.did, false).catch(() => {})
    },
    [signOut],
  )

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
      accounts,
      signIn,
      signOut,
      switchAccount,
      removeAccount,
    }
  }, [state, accounts, signIn, signOut, switchAccount, removeAccount])

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
