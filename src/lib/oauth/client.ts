import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

/**
 * BrowserOAuthClient singleton. Handles PKCE / PAR / DPoP and persists
 * sessions in IndexedDB.
 *
 * DEV (loopback): atproto allows a special "loopback" client where the
 * client_id is `http://localhost`. The library auto-derives client metadata
 * from the dev origin when you pass `clientId: undefined` with
 * `handleResolver` set, *provided* the page is served from a 127.0.0.1 /
 * localhost origin (hence vite server.host 127.0.0.1:5173). We construct the
 * loopback client_id explicitly so redirect_uri == current origin + callback.
 *
 * PROD: VITE_CLIENT_ID points at a hosted client-metadata.json (served from
 * public/client-metadata.json) and VITE_REDIRECT_URI is the deployed callback.
 */

const HANDLE_RESOLVER = 'https://bsky.social'
const SCOPE = 'atproto transition:generic transition:chat.bsky'

/**
 * Loopback hosts get the special atproto loopback client; any other origin
 * (e.g. a Cloudflare tunnel, or a real deployment) uses a hosted
 * client-metadata.json served at /client-metadata.json on that same origin.
 */
function isLoopbackOrigin(): boolean {
  return /^(127\.0\.0\.1|localhost|\[::1\])$/.test(window.location.hostname)
}

/**
 * Canonical atproto loopback client_id for development:
 *   http://localhost?redirect_uri=<enc>&scope=<enc>
 *
 * The host MUST be `localhost` (the literal recognised loopback client), while
 * the redirect_uri MUST use the loopback IP (127.0.0.1) — browsers serve the
 * app from 127.0.0.1:5173 (see vite.config.ts), so window.location.origin is
 * already IP-based here.
 */
function loopbackClientId(redirectUri: string): string {
  const params = new URLSearchParams()
  params.set('redirect_uri', redirectUri)
  params.set('scope', SCOPE)
  return `http://localhost?${params.toString()}`
}

let _client: BrowserOAuthClient | null = null

/** Lazily construct (or return) the process-wide OAuth client. */
export function getOAuthClient(): BrowserOAuthClient {
  if (_client) return _client

  const origin = window.location.origin
  const redirectUri = `${origin}/oauth/callback`

  if (isLoopbackOrigin()) {
    _client = new BrowserOAuthClient({
      handleResolver: HANDLE_RESOLVER,
      clientMetadata: {
        client_id: loopbackClientId(redirectUri),
        client_name: 'Ovoid (dev)',
        redirect_uris: [redirectUri],
        scope: SCOPE,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'native',
        dpop_bound_access_tokens: true,
      },
    })
  } else {
    // Hosted client: metadata is served at /client-metadata.json on this origin
    // (dev middleware in vite.config, or a static file in a real deploy). The
    // authorization server fetches it from the client_id URL to verify.
    _client = new BrowserOAuthClient({
      handleResolver: HANDLE_RESOLVER,
      clientMetadata: {
        client_id: `${origin}/client-metadata.json`,
        client_name: 'Ovoid',
        redirect_uris: [redirectUri],
        scope: SCOPE,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'web',
        dpop_bound_access_tokens: true,
      },
    })
  }

  return _client
}

export { SCOPE as OAUTH_SCOPE }
