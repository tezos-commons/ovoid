import { useAgent } from '@/lib/api/agent'

/**
 * Lists are addressed in the URL by (actor, rkey) but the XRPC surface keys on
 * the full AT-URI of the app.bsky.graph.list record. This builds that URI.
 *
 * Invariant: the collection segment is always `app.bsky.graph.list`; only the
 * repo (actor DID/handle) and rkey vary. The AppView resolves a handle in the
 * authority position, so passing a handle here is acceptable for reads.
 */
export function buildListUri(actor: string, rkey: string): string {
  return `at://${actor}/app.bsky.graph.list/${rkey}`
}

/** Extract (actor, rkey) from a list AT-URI for routing back to a detail page. */
export function parseListUri(uri: string): { actor: string; rkey: string } | null {
  const m = uri.match(/^at:\/\/([^/]+)\/app\.bsky\.graph\.list\/([^/]+)$/)
  if (!m) return null
  return { actor: m[1], rkey: m[2] }
}

/** Permalink to a list detail screen from its AT-URI (uses creator handle when known). */
export function listPermalink(uri: string, creatorActor?: string): string {
  const parsed = parseListUri(uri)
  if (!parsed) return '/lists'
  const actor = creatorActor || parsed.actor
  return `/profile/${actor}/lists/${parsed.rkey}`
}

/** Convenience: resolve the viewer DID for building own-repo write URIs. */
export function useViewerDid(): string | undefined {
  return useAgent().did
}
