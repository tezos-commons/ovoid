/**
 * Bidirectional rewriting between bsky.app web URLs and this app's own routes.
 *
 * Ovoid's router mirrors bsky.app's path scheme exactly:
 *   /profile/:actor
 *   /profile/:actor/post/:rkey
 *   /profile/:actor/feed/:rkey
 *   /profile/:actor/lists/:rkey
 * so a rewrite is nothing more than swapping the origin — PROVIDED the path is
 * one of those shared, internally-routable shapes. Anything else on bsky.app
 * (/settings, /starter-pack/…, the bare host, hashtag pages) has no local route,
 * so we leave those URLs untouched and they keep opening externally.
 *
 * Two directions, one path matcher:
 *  - inbound  (rendering a post): bsky.app/profile/… -> local path, so the link
 *    navigates inside the SPA instead of bouncing the user out to bsky.app.
 *  - outbound (composing a post): <our-origin>/profile/… -> bsky.app/profile/…,
 *    so the stored record is portable — every other atproto client gets a
 *    working bsky.app link, while this app rewrites it back on the way in.
 */

export const BSKY_APP_ORIGIN = 'https://bsky.app'

// Hosts we treat as canonical bsky.app web links.
const BSKY_HOSTS = new Set(['bsky.app', 'www.bsky.app'])

// The path shapes both apps route identically (leading slash, no trailing slash,
// query/hash already stripped by the caller). actor = handle or DID; the colons
// in did:plc:… are matched by [^/]+.
const ROUTABLE_PATH = /^\/profile\/[^/]+(?:\/(?:post|feed|lists)\/[^/]+)?$/

/** Normalise a single optional trailing slash, then accept only routable paths. */
function routablePath(pathname: string): string | null {
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return ROUTABLE_PATH.test(p) ? p : null
}

function currentOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

/**
 * If `uri` is a bsky.app link to a route this app can render, return the local
 * path (e.g. "/profile/alice.bsky.social/post/3k…") for in-app navigation.
 * Returns null for any other URL — caller should fall back to an external link.
 */
export function bskyUrlToInternalPath(uri: string): string | null {
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return null
  }
  if (!BSKY_HOSTS.has(u.hostname)) return null
  return routablePath(u.pathname)
}

/**
 * If `uri` points at THIS deployment's origin and a shared route, return the
 * equivalent bsky.app URL; otherwise null. `origin` defaults to the running
 * page's origin (dev: http://127.0.0.1:5173, prod: the deployed site).
 */
export function internalUrlToBskyUrl(uri: string, origin: string = currentOrigin()): string | null {
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return null
  }
  if (!origin || u.origin !== origin) return null
  const path = routablePath(u.pathname)
  return path ? BSKY_APP_ORIGIN + path : null
}

// A URL token in free text. Deliberately greedy to the next whitespace; the
// caller peels trailing punctuation back off before parsing.
const URL_TOKEN = /https?:\/\/[^\s]+/g
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/

/**
 * Rewrite every self-referential (this-origin) link in `text` to its bsky.app
 * equivalent, in place, leaving all other text and URLs byte-for-byte intact.
 * Run before facet detection when composing so both the stored text and the
 * facets it produces point at bsky.app.
 *
 * Trailing punctuation that a URL regex would otherwise swallow ("see …/post/x.")
 * is split off and re-appended so the sentence survives the rewrite.
 */
export function rewriteSelfLinksToBsky(text: string, origin?: string): string {
  return text.replace(URL_TOKEN, (token) => {
    const trail = token.match(TRAILING_PUNCT)?.[0] ?? ''
    const core = trail ? token.slice(0, token.length - trail.length) : token
    const bsky = internalUrlToBskyUrl(core, origin)
    return bsky ? bsky + trail : token
  })
}
