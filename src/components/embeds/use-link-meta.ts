import { queryOptions, useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'

/**
 * OpenGraph-ish metadata for an arbitrary URL via cardyb.bsky.app — the same
 * CORS-open extractor the official client uses for compose-time link cards.
 * This is how link cards work for URLs that never pass through the AppView
 * (chat messages): title/description/image only. The standard.site enrichment
 * fields (source publication, byline, reading time) exist solely on AppView-
 * hydrated post embeds and are not available here.
 */
export interface LinkMeta {
  title: string
  description: string
  image?: string
}

const CARDYB = 'https://cardyb.bsky.app/v1/extract'

/**
 * Shared query config so any future prefetcher reuses the exact key. A URL
 * with no card-worthy metadata resolves to null (cached — we don't refetch
 * known misses every render). Metadata is near-immutable; long staleTime.
 */
export function linkMetaOptions(url: string) {
  return queryOptions({
    queryKey: qk.linkMeta(url),
    queryFn: async (): Promise<LinkMeta | null> => {
      const res = await fetch(`${CARDYB}?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error(`link extract ${res.status}`)
      const j = (await res.json()) as {
        error?: string
        title?: string
        description?: string
        image?: string
      }
      if (j.error || !j.title) return null
      return { title: j.title, description: j.description ?? '', image: j.image || undefined }
    },
    staleTime: 12 * 60 * 60_000,
  })
}

export function useLinkMeta(url: string | undefined) {
  return useQuery({ ...linkMetaOptions(url ?? ''), enabled: !!url })
}
