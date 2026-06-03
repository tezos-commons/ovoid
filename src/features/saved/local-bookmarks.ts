/**
 * Client-only bookmark fallback.
 *
 * The native `app.bsky.bookmark.*` lexicon (createBookmark/deleteBookmark/
 * getBookmarks) is a server-side, private, per-user set added late 2025. When
 * the connected AppView predates it — or the agent build lacks the namespace —
 * we cannot enumerate bookmarks via the network. This module persists a set of
 * StrongRefs in localStorage, keyed by viewer DID, so the Bookmarks tab still
 * works as a *client-only* feature. It is clearly surfaced as such in the UI.
 *
 * Invariant: a bookmark is identified by the bookmarked post's AT-URI (the same
 * primary key the native API uses for delete), so the two code paths agree on
 * identity and a local entry can be re-hydrated via getPosts(uris).
 */

export interface LocalBookmark {
  uri: string
  cid: string
  /** ms epoch the bookmark was created locally; used for reverse-chron order. */
  savedAt: number
}

const KEY_PREFIX = 'ovoid:bookmarks:'

function keyFor(did: string | undefined): string {
  return KEY_PREFIX + (did ?? 'anon')
}

function read(did: string | undefined): LocalBookmark[] {
  try {
    const raw = localStorage.getItem(keyFor(did))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as LocalBookmark[]) : []
  } catch {
    return []
  }
}

function write(did: string | undefined, items: LocalBookmark[]): void {
  try {
    localStorage.setItem(keyFor(did), JSON.stringify(items))
  } catch {
    /* quota / private mode — bookmarks are best-effort in fallback mode */
  }
}

/** All local bookmarks for a viewer, newest first. */
export function listLocalBookmarks(did: string | undefined): LocalBookmark[] {
  return read(did).slice().sort((a, b) => b.savedAt - a.savedAt)
}

export function isLocallyBookmarked(did: string | undefined, uri: string): boolean {
  return read(did).some((b) => b.uri === uri)
}

/** Add (idempotent on uri). */
export function addLocalBookmark(
  did: string | undefined,
  ref: { uri: string; cid: string },
): void {
  const items = read(did)
  if (items.some((b) => b.uri === ref.uri)) return
  items.push({ uri: ref.uri, cid: ref.cid, savedAt: Date.now() })
  write(did, items)
}

/** Remove by post AT-URI. */
export function removeLocalBookmark(did: string | undefined, uri: string): void {
  write(
    did,
    read(did).filter((b) => b.uri !== uri),
  )
}
