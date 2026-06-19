import { queryClient } from '@/lib/query-client'
import { extractTextUrls } from '@/lib/bsky-links'
import { documentOptions, type DocumentView } from './use-document'

/**
 * The shareable, Bluesky-embeddable URL for a standard.site document is its
 * CANONICAL url (`publication.url` + `doc.path`) — never our internal
 * `/read/<did>/<rkey>` route, which is a client-side SPA path the AppView can't
 * enrich. The canonical is computed uniformly for any standard.site doc, so this
 * works the same for an Ovoid-hosted article (`<sub>.ovoid.at/…`) and one hosted
 * on Leaflet, matuzo.at, etc. (their own verified URLs).
 */

/** Resolve a reader (did, rkey) to the document's canonical embeddable URL. */
async function resolveCanonical(authority: string, rkey: string): Promise<string | null> {
  try {
    const view = await queryClient.fetchQuery(documentOptions(authority, rkey))
    return view.canonicalUrl ?? null
  } catch {
    return null
  }
}

/** If `u` is one of our reader article URLs, its (authority, rkey); else null. */
function readerTarget(u: URL): { authority: string; rkey: string } | null {
  const sameOrigin = typeof window !== 'undefined' && u.host === window.location.host
  const isOvoid = u.hostname === 'ovoid.at' || u.hostname.endsWith('.ovoid.at')
  if (!sameOrigin && !isOvoid) return null
  const m = /^\/read\/([^/]+)\/([^/]+)\/?$/.exec(u.pathname)
  return m ? { authority: decodeURIComponent(m[1]), rkey: m[2] } : null
}

/**
 * Rewrite any Ovoid reader links in `text` to the article's canonical embeddable
 * URL, so a shared post/chat gets the rich standard.site embed (incl. the author
 * + Follow button) instead of a dead SPA link. Unresolvable links are left as-is.
 */
export async function rewriteEmbeddableLinks(text: string): Promise<string> {
  let out = text
  for (const raw of extractTextUrls(text)) {
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      continue
    }
    const target = readerTarget(u)
    if (!target) continue
    const canonical = await resolveCanonical(target.authority, target.rkey)
    if (canonical && canonical !== raw) out = out.split(raw).join(canonical)
  }
  return out
}

/** Share an article via the native sheet (or clipboard), using its canonical URL. */
export async function shareArticle(view: DocumentView): Promise<void> {
  const rkey = view.uri.split('/').pop() ?? ''
  const fallback =
    typeof window !== 'undefined' ? `${window.location.origin}/read/${view.did}/${rkey}` : ''
  const url = view.canonicalUrl ?? fallback
  if (!url) return
  try {
    if (navigator.share) await navigator.share({ title: view.doc.title, url })
    else await navigator.clipboard?.writeText(url)
  } catch {
    /* user cancelled the share sheet */
  }
}
