/**
 * Unauthenticated reads against an arbitrary repo's PDS.
 *
 * `site.standard.*` / `pub.leaflet.*` records live in the author's PDS repo, not
 * in the Bluesky AppView — so the shared public agent (which targets
 * public.api.bsky.app) can't read them. We resolve the DID to its PDS service
 * endpoint and hit `com.atproto.repo.getRecord` / `com.atproto.sync.getBlob`
 * there directly; both are public, so no session is needed.
 *
 * We deliberately use raw `fetch` rather than @atproto/api's typed getRecord:
 * the SDK lexicon-parses responses, hydrating every `{$type:'blob', ref:{$link}}`
 * into a BlobRef instance (and `{$link}` CIDs into CID objects), which strips the
 * `$link` strings our renderers read. Raw JSON keeps records exactly as stored.
 */

// did -> pds endpoint. Immutable enough within a session to cache for the
// process lifetime; a stale PDS only matters across a repo migration.
const pdsCache = new Map<string, string>()

/** did:web:example.com[:path…] -> the did.json URL per the did:web spec. */
function didWebDocUrl(did: string): string {
  const segs = did.slice('did:web:'.length).split(':').map(decodeURIComponent)
  const host = segs[0]
  return segs.length > 1
    ? `https://${host}/${segs.slice(1).join('/')}/did.json`
    : `https://${host}/.well-known/did.json`
}

interface DidDoc {
  service?: { id: string; type: string; serviceEndpoint: string }[]
}

/** Resolve a DID to its `#atproto_pds` service endpoint. */
export async function pdsForDid(did: string): Promise<string> {
  const cached = pdsCache.get(did)
  if (cached) return cached

  const url = did.startsWith('did:web:')
    ? didWebDocUrl(did)
    : `https://plc.directory/${encodeURIComponent(did)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DID resolution failed (${res.status}) for ${did}`)
  const doc: DidDoc = await res.json()
  const pds = doc.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint
  if (!pds) throw new Error(`no #atproto_pds service for ${did}`)

  pdsCache.set(did, pds)
  return pds
}

/** Raw (un-hydrated) repo record from a PDS. Blob refs keep their `{$link}`. */
export async function getRecordRaw<T = unknown>(
  pds: string,
  repo: string,
  collection: string,
  rkey: string,
): Promise<{ uri: string; cid?: string; value: T }> {
  const u = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`)
  u.searchParams.set('repo', repo)
  u.searchParams.set('collection', collection)
  u.searchParams.set('rkey', rkey)
  const res = await fetch(u)
  if (!res.ok) throw new Error(`getRecord ${collection}/${rkey} → ${res.status}`)
  return res.json()
}

/** Raw (un-hydrated) page of repo records of one collection. */
export async function listRecordsRaw<T = unknown>(
  pds: string,
  repo: string,
  collection: string,
  opts?: { cursor?: string; limit?: number },
): Promise<{ records: { uri: string; value: T }[]; cursor?: string }> {
  const u = new URL(`${pds}/xrpc/com.atproto.repo.listRecords`)
  u.searchParams.set('repo', repo)
  u.searchParams.set('collection', collection)
  u.searchParams.set('limit', String(opts?.limit ?? 100))
  if (opts?.cursor) u.searchParams.set('cursor', opts.cursor)
  const res = await fetch(u)
  if (!res.ok) throw new Error(`listRecords ${collection} → ${res.status}`)
  return res.json()
}

/** Public blob URL on a PDS (for <img src>). */
export function blobUrl(pds: string, did: string, cid: string): string {
  return `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
}
