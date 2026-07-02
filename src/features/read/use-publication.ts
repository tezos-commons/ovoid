import { useQuery, queryOptions } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { getRecordRaw, listRecordsRaw, pdsForDid } from '@/lib/api/repo-read'
import type { StandardDocument, StandardPublication } from './use-document'

interface AtUriParts {
  did: string
  collection: string
  rkey: string
}
function parsePubUri(pubUri: string): AtUriParts | null {
  const m = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(pubUri)
  return m ? { did: m[1], collection: m[2], rkey: m[3] } : null
}

/** Internal route to a publication's index page, from its at:// URI. */
export function pubPath(pubUri: string): string | null {
  const p = parsePubUri(pubUri)
  return p ? `/pub/${p.did}/${p.collection}/${p.rkey}` : null
}

export interface PublicationView {
  did: string
  pds: string
  record: StandardPublication
}

/** The publication record itself (name / icon / url / description). */
export function publicationRecordOptions(pubUri: string) {
  return queryOptions<PublicationView>({
    queryKey: qk.publicationRecord(pubUri),
    enabled: pubUri.startsWith('at://'),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const p = parsePubUri(pubUri)
      if (!p) throw new Error(`bad publication uri: ${pubUri}`)
      const pds = await pdsForDid(p.did)
      const rec = await getRecordRaw<StandardPublication>(pds, p.did, p.collection, p.rkey)
      return { did: p.did, pds, record: rec.value }
    },
  })
}

export function usePublicationRecord(pubUri: string | undefined) {
  return useQuery({
    ...publicationRecordOptions(pubUri ?? ''),
    enabled: !!pubUri && pubUri.startsWith('at://'),
  })
}

export interface PublicationDoc {
  did: string
  rkey: string
  uri: string
  title: string
  publishedAt: string
  description?: string
  /** Document path relative to the publication (for URL → doc resolution). */
  path?: string
}

const DOC = 'site.standard.document'

function ownerDid(pubUri: string): string | null {
  return /^at:\/\/([^/]+)\//.exec(pubUri)?.[1] ?? null
}

/**
 * Every article in a publication, newest first. Lists the publication owner's
 * repo and keeps the documents whose `site` points at this publication — so it
 * captures all articles of a single-author publication (the common case) with
 * no backend. Documents authored in *other* repos (a multi-author publication)
 * are not visible this way; that needs a cross-repo backlink index (Constellation).
 */
export function publicationDocsOptions(pubUri: string) {
  return queryOptions<PublicationDoc[]>({
    queryKey: qk.publicationDocs(pubUri),
    enabled: pubUri.startsWith('at://'),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const did = ownerDid(pubUri)
      if (!did) return []
      const pds = await pdsForDid(did)

      const docs: PublicationDoc[] = []
      let cursor: string | undefined
      do {
        const page = await listRecordsRaw<StandardDocument>(pds, did, DOC, { cursor, limit: 100 })
        for (const r of page.records) {
          if (r.value.site !== pubUri) continue
          docs.push({
            did,
            rkey: r.uri.split('/').pop() ?? '',
            uri: r.uri,
            title: r.value.title,
            publishedAt: r.value.publishedAt,
            description: r.value.description,
            path: r.value.path,
          })
        }
        cursor = page.cursor
      } while (cursor)

      docs.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      return docs
    },
  })
}

export function usePublicationDocs(pubUri: string | undefined) {
  return useQuery({
    ...publicationDocsOptions(pubUri ?? ''),
    enabled: !!pubUri && pubUri.startsWith('at://'),
  })
}

const PUB = 'site.standard.publication'

export interface ProfilePublication {
  did: string
  pds: string
  uri: string
  record: StandardPublication
}

/**
 * Every `site.standard.publication` record in an author's repo — a public read
 * (no viewer). Used to surface a publication card on the profile; there is no
 * Bluesky `associated.publications` count to gate on, so the repo is scanned.
 */
export function profilePublicationsOptions(did: string) {
  return queryOptions<ProfilePublication[]>({
    queryKey: qk.authorPublications(did),
    enabled: !!did,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const pds = await pdsForDid(did)
      const pubs: ProfilePublication[] = []
      let cursor: string | undefined
      do {
        const page = await listRecordsRaw<StandardPublication>(pds, did, PUB, { cursor, limit: 100 })
        for (const r of page.records) {
          pubs.push({ did, pds, uri: r.uri, record: r.value })
        }
        cursor = page.cursor
      } while (cursor)
      return pubs
    },
  })
}

export function useProfilePublications(did: string | undefined) {
  return useQuery({ ...profilePublicationsOptions(did ?? ''), enabled: !!did })
}
