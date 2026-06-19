import { useQuery, queryOptions } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { qk } from '@/lib/query-keys'
import { makePublicAgent } from '@/lib/api/public-agent'
import { getRecordRaw, pdsForDid } from '@/lib/api/repo-read'
import type { BlobRef } from './leaflet'

/** site.standard.document record value (the fields we read). Content is open. */
export interface StandardDocument {
  site: string // at:// publication record, or https:// url (loose doc)
  title: string
  publishedAt: string
  path?: string
  description?: string
  coverImage?: BlobRef
  content?: { $type: string } & Record<string, unknown>
  textContent?: string
  tags?: string[]
  contributors?: { did: string; role?: string; displayName?: string }[]
  updatedAt?: string
}

/** site.standard.publication record value (the fields we render). */
export interface StandardPublication {
  url: string
  name: string
  description?: string
  icon?: BlobRef
}

export interface DocumentView {
  did: string
  pds: string
  uri: string
  doc: StandardDocument
  author: AppBskyActorDefs.ProfileViewBasic | null
  /** Resolved when `site` is an at:// publication record. */
  publication: { pds: string; did: string; record: StandardPublication } | null
  /** Best canonical web URL, if derivable (publication url / https site + path). */
  canonicalUrl: string | null
}

const DOC = 'site.standard.document'
const PUB = 'site.standard.publication'

interface AtUri {
  did: string
  collection: string
  rkey: string
}
function parseAtUri(uri: string): AtUri | null {
  const m = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri)
  return m ? { did: m[1], collection: m[2], rkey: m[3] } : null
}

function joinUrl(base: string, path?: string): string {
  if (!path) return base
  return base.replace(/\/+$/, '') + (path.startsWith('/') ? path : `/${path}`)
}

async function resolveDid(authority: string): Promise<string> {
  const v = authority.trim().replace(/^@/, '')
  if (v.startsWith('did:')) return v
  const res = await makePublicAgent().com.atproto.identity.resolveHandle({ handle: v })
  return res.data.did
}

/**
 * Shared config for the public reader. `authority` is a handle or DID, `rkey`
 * the document TID. Pure public reads (no viewer), so the key carries no DID;
 * the same article resolves identically for everyone, signed in or out.
 */
export function documentOptions(authority: string, rkey: string) {
  return queryOptions<DocumentView>({
    queryKey: qk.standardDoc(authority, rkey),
    queryFn: async () => {
      const did = await resolveDid(authority)
      const pds = await pdsForDid(did)

      const data = await getRecordRaw<StandardDocument>(pds, did, DOC, rkey)
      const doc = data.value

      // Author profile + publication in parallel — neither blocks the document.
      const pub = parseAtUri(doc.site)
      const [author, publication] = await Promise.all([
        makePublicAgent()
          .app.bsky.actor.getProfile({ actor: did })
          .then((r) => r.data as AppBskyActorDefs.ProfileViewBasic)
          .catch(() => null),
        pub && pub.collection === PUB
          ? (async () => {
              const pubPds = await pdsForDid(pub.did)
              const rec = await getRecordRaw<StandardPublication>(pubPds, pub.did, PUB, pub.rkey)
              return { pds: pubPds, did: pub.did, record: rec.value }
            })().catch(() => null)
          : Promise.resolve(null),
      ])

      const base = doc.site.startsWith('https://')
        ? doc.site
        : (publication?.record.url ?? null)
      const canonicalUrl = base ? joinUrl(base, doc.path) : null

      return { did, pds, uri: data.uri, doc, author, publication, canonicalUrl }
    },
    staleTime: 5 * 60_000,
  })
}

export function useDocument(authority: string | undefined, rkey: string | undefined) {
  return useQuery({
    ...documentOptions(authority ?? '', rkey ?? ''),
    enabled: !!authority && !!rkey,
  })
}
