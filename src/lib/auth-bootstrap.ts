import type { OAuthSession } from '@atproto/oauth-client-browser'
import { getOAuthClient } from './oauth/client'

export interface InitResult {
  session?: OAuthSession
  /** The `state` string passed to signIn() — used to restore the pre-login path. */
  state?: string | null
}

/**
 * One-shot OAuth initialisation. Wraps `oauthClient.init()`, which:
 *   - on a callback URL, consumes the code/state params and returns the new session;
 *   - otherwise restores any persisted session from IndexedDB.
 *
 * Call exactly once before rendering the tree (from main.tsx). The AuthProvider
 * reads the resolved result; subsequent session changes flow through the
 * client's session-store events.
 */
let _bootstrap: Promise<InitResult | undefined> | null = null

export function bootstrap(): Promise<InitResult | undefined> {
  // Memoize so React StrictMode's double-mount (or any second caller) reuses
  // the single init() — calling oauthClient.init() twice would re-consume /
  // invalidate the callback params.
  if (!_bootstrap) {
    _bootstrap = (async () => {
      const client = getOAuthClient()
      const result = await client.init()
      if (!result) return undefined
      // init() returns { session } always, and { state } only on a fresh callback.
      return {
        session: result.session,
        state: 'state' in result ? (result.state ?? null) : null,
      }
    })()
  }
  return _bootstrap
}
