import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import {
  listPublicationRegs,
  putPublicationReg,
  getPublicationReg,
  deletePublicationReg,
  type PublicationReg,
} from '@/lib/data/publications'

export const PUBLICATION_COLLECTION = 'site.standard.publication'

/** Subdomain → canonical publication URL. The record's `url` must match this. */
export function publicationUrl(subdomain: string): string {
  return `https://${subdomain}.ovoid.at`
}

/** The caller's own publication registrations. */
export function usePublications() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    queryKey: qk.publications(did),
    enabled: isAuthed && !!did,
    staleTime: 60_000,
    queryFn: () => listPublicationRegs(agent),
  })
}

export interface CreatePublicationInput {
  subdomain: string
  name: string
  description?: string
  icon?: File | null
}

/**
 * Create a publication: write a `site.standard.publication` record to the user's
 * repo (url = the subdomain canonical), then register the subdomain → that
 * record. If registration fails (taken / reserved / quota), the orphan record is
 * rolled back so a retry is clean.
 */
export function useCreatePublication() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ subdomain, name, description, icon }: CreatePublicationInput) => {
      if (!did) throw new Error('Not signed in')
      const sub = subdomain.trim().toLowerCase()

      let iconBlob: unknown
      if (icon) {
        const bytes = new Uint8Array(await icon.arrayBuffer())
        const up = await agent.com.atproto.repo.uploadBlob(bytes, {
          encoding: icon.type || 'application/octet-stream',
        })
        iconBlob = up.data.blob
      }

      const record = {
        $type: PUBLICATION_COLLECTION,
        url: publicationUrl(sub),
        name: name.trim(),
        ...(description?.trim() ? { description: description.trim() } : {}),
        ...(iconBlob ? { icon: iconBlob } : {}),
      }
      const created = await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: PUBLICATION_COLLECTION,
        record,
      })

      try {
        await putPublicationReg(agent, sub, created.data.uri)
      } catch (err) {
        const rkey = created.data.uri.split('/').pop()
        if (rkey) {
          await agent.com.atproto.repo
            .deleteRecord({ repo: did, collection: PUBLICATION_COLLECTION, rkey })
            .catch(() => {})
        }
        throw err
      }
      return { subdomain: sub, uri: created.data.uri }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.publications(did) }),
  })
}

export interface UpdatePublicationInput {
  /** at-uri of the publication record to update. */
  uri: string
  /** Canonical url to preserve (the record requires it). */
  url: string
  name: string
  description?: string
  /** New icon to upload; omit to keep the existing one. */
  iconFile?: File | null
  /** Existing icon blob (raw JSON form), preserved when no new file is given. */
  currentIcon?: unknown
}

/** Update a publication's record (name / description / icon). url is immutable. */
export function useUpdatePublication() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdatePublicationInput) => {
      if (!did) throw new Error('Not signed in')
      const rkey = input.uri.split('/').pop()
      if (!rkey) throw new Error('Bad publication uri')

      let icon: unknown = input.currentIcon
      if (input.iconFile) {
        const bytes = new Uint8Array(await input.iconFile.arrayBuffer())
        const up = await agent.com.atproto.repo.uploadBlob(bytes, {
          encoding: input.iconFile.type || 'application/octet-stream',
        })
        icon = up.data.blob
      }

      const record = {
        $type: PUBLICATION_COLLECTION,
        url: input.url,
        name: input.name.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(icon ? { icon } : {}),
      }
      await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: PUBLICATION_COLLECTION,
        rkey,
        record,
      })
      return { uri: input.uri }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.publicationRecordsAll })
      qc.invalidateQueries({ queryKey: qk.publications(did) })
    },
  })
}

/** Delete a registration and (best-effort) its publication record. */
export function useDeletePublication() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ subdomain, uri }: { subdomain: string; uri: string }) => {
      await deletePublicationReg(agent, subdomain)
      const rkey = uri.split('/').pop()
      if (did && rkey) {
        await agent.com.atproto.repo
          .deleteRecord({ repo: did, collection: PUBLICATION_COLLECTION, rkey })
          .catch(() => {})
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.publications(did) }),
  })
}

/** Is a subdomain free? Returns the existing registration if taken, else null. */
export function checkSubdomainFree(agent: Agent, subdomain: string): Promise<PublicationReg | null> {
  return getPublicationReg(agent, subdomain.trim().toLowerCase())
}

/** Server-rejected labels (mirrors the API's reserved set). */
export const RESERVED_SUBDOMAINS = [
  'me', 'www', 'api', 'admin', 'app', 'data', 'static', 'assets', 'cdn', 'mail',
]

/** Client-side DNS-label validation, mirroring the API rules. Null when valid. */
export function subdomainError(subdomain: string): string | null {
  const s = subdomain.trim().toLowerCase()
  if (!s) return null
  if (!/^[a-z0-9-]{1,63}$/.test(s)) return 'Use 1–63 letters, numbers, or hyphens.'
  if (s.startsWith('-') || s.endsWith('-')) return 'Cannot start or end with a hyphen.'
  if (RESERVED_SUBDOMAINS.includes(s)) return 'That subdomain is reserved.'
  return null
}

export function isValidSubdomain(subdomain: string): boolean {
  const s = subdomain.trim()
  return s.length > 0 && subdomainError(s) === null
}

/** Availability of a (validated) subdomain — `data` is the taker, or null if free. */
export function useSubdomainAvailability(subdomain: string) {
  const { agent, isAuthed } = useAgent()
  const sub = subdomain.trim().toLowerCase()
  return useQuery({
    queryKey: qk.publicationSubdomain(sub),
    enabled: isAuthed && isValidSubdomain(sub),
    staleTime: 30_000,
    queryFn: () => checkSubdomainFree(agent, sub),
  })
}
