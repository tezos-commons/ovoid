import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import {
  usePublicationRecord,
  usePublicationDocs,
  publicationDocsOptions,
} from '@/features/read/use-publication'
import { qk } from '@/lib/query-keys'
import { useDocument, type StandardDocument } from '@/features/read/use-document'
import { usePublications } from './use-publications'

export const DOCUMENT_COLLECTION = 'site.standard.document'

/** at://<did>/… → the authoring DID. */
function uriDid(uri: string | undefined): string | undefined {
  return uri ? /^at:\/\/([^/]+)\//.exec(uri)?.[1] : undefined
}

/**
 * Resolve a publication subdomain to its studio context: the registration, the
 * publication at-uri + owning DID, the publication record (name/icon), and the
 * list of its documents.
 */
export function usePublicationStudio(subdomain: string | undefined) {
  const pubs = usePublications()
  const reg = pubs.data?.find((r) => r.subdomain === subdomain)
  const pubUri = reg?.uri
  const did = uriDid(pubUri)
  const record = usePublicationRecord(pubUri)
  const posts = usePublicationDocs(pubUri)
  return {
    reg,
    pubUri,
    did,
    record,
    posts,
    notFound: !pubs.isPending && !reg,
    isPending: pubs.isPending || (!!pubUri && record.isPending),
  }
}

/** Load one document's record for editing (reuses the reader's cached query). */
export function useEditableDocument(did: string | undefined, rkey: string | undefined) {
  const q = useDocument(did, rkey)
  return { ...q, doc: q.data?.doc as StandardDocument | undefined }
}

/** Crude markdown → plaintext for the document's `textContent` (excerpt/search). */
export function markdownToPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Title → URL slug. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  )
}

/** Extract editable markdown from a document's content (markpub), else ''. */
export function documentMarkdown(doc: StandardDocument | undefined): string {
  const c = doc?.content
  if (c?.$type === 'at.markpub.markdown') {
    const md = (c.text as { markdown?: unknown } | undefined)?.markdown
    if (typeof md === 'string') return md
  }
  return doc?.textContent ?? ''
}

export interface SavePostInput {
  /** Present = update that record; absent = create a new one. */
  rkey?: string
  title: string
  slug: string
  description?: string
  markdown: string
  tags?: string[]
  /** New cover to upload (≤1MB). Takes precedence over `coverImage`. */
  coverFile?: File | null
  /** Existing cover blob (raw JSON) to preserve; omit to drop the cover. */
  coverImage?: unknown
  /** Original publish time when updating; defaults to now on create. */
  publishedAt?: string
}

/**
 * Create or update a `site.standard.document` in the user's repo, referencing
 * the publication. Content is written as `at.markpub.markdown`.
 */
export function useSavePost(pubUri: string | undefined, did: string | undefined) {
  const { agent } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SavePostInput) => {
      if (!pubUri || !did) throw new Error('No publication')
      const now = new Date().toISOString()

      let coverImage: unknown = input.coverImage
      if (input.coverFile) {
        const bytes = new Uint8Array(await input.coverFile.arrayBuffer())
        const up = await agent.com.atproto.repo.uploadBlob(bytes, {
          encoding: input.coverFile.type || 'application/octet-stream',
        })
        coverImage = up.data.blob
      }

      const record: Record<string, unknown> = {
        $type: DOCUMENT_COLLECTION,
        site: pubUri,
        title: input.title.trim(),
        path: `/${input.slug}`,
        publishedAt: input.publishedAt ?? now,
        content: {
          $type: 'at.markpub.markdown',
          flavor: 'gfm',
          text: { $type: 'at.markpub.text', markdown: input.markdown },
        },
        textContent: markdownToPlain(input.markdown),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.tags?.length ? { tags: input.tags } : {}),
        ...(coverImage ? { coverImage } : {}),
        ...(input.rkey ? { updatedAt: now } : {}),
      }

      if (input.rkey) {
        await agent.com.atproto.repo.putRecord({
          repo: did,
          collection: DOCUMENT_COLLECTION,
          rkey: input.rkey,
          record,
        })
        return { rkey: input.rkey }
      }
      const res = await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: DOCUMENT_COLLECTION,
        record,
      })
      return { rkey: res.data.uri.split('/').pop() ?? '' }
    },
    onSuccess: () => {
      if (pubUri) qc.invalidateQueries({ queryKey: publicationDocsOptions(pubUri).queryKey })
      // Refresh any open reader copy (prefix-invalidate the document family).
      qc.invalidateQueries({ queryKey: qk.standardDocsAll })
    },
  })
}

/** Delete a document from the user's repo. */
export function useDeletePost(pubUri: string | undefined, did: string | undefined) {
  const { agent } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rkey: string) => {
      if (!did) throw new Error('Not signed in')
      await agent.com.atproto.repo.deleteRecord({ repo: did, collection: DOCUMENT_COLLECTION, rkey })
    },
    onSuccess: () => {
      if (pubUri) qc.invalidateQueries({ queryKey: publicationDocsOptions(pubUri).queryKey })
    },
  })
}
