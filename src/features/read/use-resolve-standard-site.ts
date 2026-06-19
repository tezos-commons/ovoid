import { queryOptions, useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { queryClient } from '@/lib/query-client'
import { publicationDocsOptions } from './use-publication'

function normPath(p: string | undefined): string {
  if (!p) return ''
  const trimmed = p.replace(/\/+$/, '')
  return trimmed || '/'
}

/**
 * Resolve an arbitrary web URL to a `site.standard.document` at-uri, or null.
 *
 * standard.site's discovery is used directly (the AppView's associatedRefs only
 * exist on post embeds, not chat links):
 *   1. `<origin>/.well-known/site.standard.publication` → the publication at-uri
 *      (served with CORS `*` per the spec).
 *   2. that publication's documents are listed, and the one whose `path` matches
 *      the URL's path is the article.
 *
 * Single-author publications resolve fully; an article authored in a different
 * repo than its publication won't (same cross-repo limit as the index page).
 */
export function standardSiteResolveOptions(url: string) {
  return queryOptions<string | null>({
    queryKey: qk.standardSiteResolve(url),
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: async () => {
      let origin: string
      let pathname: string
      try {
        const u = new URL(url)
        origin = u.origin
        pathname = normPath(u.pathname)
      } catch {
        return null
      }

      let pubUri: string
      try {
        const res = await fetch(`${origin}/.well-known/site.standard.publication`)
        if (!res.ok) return null
        pubUri = (await res.text()).trim()
      } catch {
        return null // no well-known, or CORS-blocked → not resolvable here
      }
      if (!pubUri.startsWith('at://')) return null

      const docs = await queryClient.ensureQueryData(publicationDocsOptions(pubUri))
      const hit = docs.find((d) => {
        const dp = normPath(d.path)
        return dp === pathname || (dp.length > 1 && pathname.endsWith(dp))
      })
      return hit?.uri ?? null
    },
  })
}

export function useResolveStandardSite(url: string | undefined) {
  return useQuery({
    ...standardSiteResolveOptions(url ?? ''),
    enabled: !!url && /^https?:\/\//.test(url),
  })
}
