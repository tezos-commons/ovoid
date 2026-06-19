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

/** If `u` is one of our reader article URLs, its (authority, rkey); else null. */
function readerTarget(u: URL): { authority: string; rkey: string } | null {
  const sameOrigin = typeof window !== 'undefined' && u.host === window.location.host
  const isOvoid = u.hostname === 'ovoid.at' || u.hostname.endsWith('.ovoid.at')
  if (!sameOrigin && !isOvoid) return null
  const m = /^\/read\/([^/]+)\/([^/]+)\/?$/.exec(u.pathname)
  return m ? { authority: decodeURIComponent(m[1]), rkey: m[2] } : null
}

/** A standard.site article resolved from a reader link in composed text. */
export interface EmbeddableArticle {
  url: string
  title: string
  description?: string
}

/**
 * Rewrite Ovoid reader links to the article's canonical embeddable URL AND return
 * the resolved articles, so the composer can both (a) post the embeddable link
 * (rich standard.site card on Bluesky, incl. author + Follow) instead of a dead
 * SPA link, and (b) attach the external embed the card actually renders from.
 * Unresolvable links are left as-is.
 */
export async function resolveEmbeddableLinks(
  text: string,
): Promise<{ text: string; articles: EmbeddableArticle[] }> {
  let out = text
  const articles: EmbeddableArticle[] = []
  for (const raw of extractTextUrls(text)) {
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      continue
    }
    const target = readerTarget(u)
    if (!target) continue
    let view: DocumentView
    try {
      view = await queryClient.fetchQuery(documentOptions(target.authority, target.rkey))
    } catch {
      continue
    }
    const canonical = view.canonicalUrl
    if (!canonical) continue
    if (canonical !== raw) out = out.split(raw).join(canonical)
    articles.push({ url: canonical, title: view.doc.title, description: view.doc.description })
  }
  return { text: out, articles }
}

/** Text-only rewrite (chat, where we don't attach external embeds). */
export async function rewriteEmbeddableLinks(text: string): Promise<string> {
  return (await resolveEmbeddableLinks(text)).text
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
