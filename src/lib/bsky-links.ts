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

// Group-chat invite links are the one shared destination whose PATH differs
// between the apps: bsky.app/chat/<code> vs our /group/join/<code>. Mapped
// explicitly in both directions below.
const BSKY_CHAT_PATH = /^\/chat\/([A-Za-z0-9_-]+)$/
const OVOID_JOIN_PATH = /^\/group\/join\/([A-Za-z0-9_-]+)$/

/** The invite code when `uri` is a group-chat invite link on either domain. */
export function groupInviteCode(uri: string): string | null {
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return null
  }
  if (BSKY_HOSTS.has(u.hostname)) return u.pathname.match(BSKY_CHAT_PATH)?.[1] ?? null
  if (u.origin === currentOrigin()) return u.pathname.match(OVOID_JOIN_PATH)?.[1] ?? null
  return null
}

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
  const chat = u.pathname.match(BSKY_CHAT_PATH)
  if (chat) return `/group/join/${chat[1]}`
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
  const join = u.pathname.match(OVOID_JOIN_PATH)
  if (join) return `${BSKY_APP_ORIGIN}/chat/${join[1]}`
  const path = routablePath(u.pathname)
  return path ? BSKY_APP_ORIGIN + path : null
}

// A URL token in free text. Deliberately greedy to the next whitespace; the
// caller peels trailing punctuation back off before parsing.
const URL_TOKEN = /https?:\/\/[^\s]+/g
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/

/**
 * All http(s) URLs appearing in free text, trailing punctuation peeled. Used
 * for link surfaces over text that never went through facet detection (e.g.
 * chat messages sent by clients that didn't attach facets).
 */
export function extractTextUrls(text: string): string[] {
  const out: string[] = []
  for (const token of text.match(URL_TOKEN) ?? []) {
    const trail = token.match(TRAILING_PUNCT)?.[0] ?? ''
    out.push(trail ? token.slice(0, token.length - trail.length) : token)
  }
  return out
}

/**
 * If `uri` is a post permalink on bsky.app OR this deployment, return its route
 * params — actor exactly as the URL carried it (handle or DID), which is what
 * buildPostUri/the thread route key expect. Null for everything else.
 */
export function postLinkParams(uri: string): { actor: string; rkey: string } | null {
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return null
  }
  if (!BSKY_HOSTS.has(u.hostname) && u.origin !== currentOrigin()) return null
  const path = routablePath(u.pathname)
  const m = path?.match(/^\/profile\/([^/]+)\/post\/([^/]+)$/)
  return m ? { actor: m[1], rkey: m[2] } : null
}

/**
 * True when `uri` points at a page of this app or bsky.app (any routable or
 * non-routable path). Such links are in-app navigation targets, not candidates
 * for an external link-preview card.
 */
export function isAppLink(uri: string): boolean {
  try {
    const u = new URL(uri)
    return BSKY_HOSTS.has(u.hostname) || u.origin === currentOrigin()
  } catch {
    return false
  }
}

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
