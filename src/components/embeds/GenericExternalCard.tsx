import clsx from 'clsx'
import { Link } from 'react-router-dom'
import type { AppBskyEmbedExternal } from '@atproto/api'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { documentOptions } from '@/features/read/use-document'
import { publicationRecordOptions, publicationDocsOptions } from '@/features/read/use-publication'

export interface ExternalEmbedProps {
  external: AppBskyEmbedExternal.ViewExternal
}

function hostname(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function cssRgb(c?: { r: number; g: number; b: number }): string | undefined {
  return c ? `rgb(${c.r} ${c.g} ${c.b})` : undefined
}

interface ReaderTarget {
  path: string
  /** Set for document links — the params documentOptions keys on. */
  doc?: { authority: string; rkey: string }
  /** Set for bare publication links — the at-uri the pub screen keys on. */
  pubUri?: string
}

/**
 * If the AppView backed this external link with a standard.site record (carried
 * in `associatedRefs`), return the in-app reader target so the card opens in
 * Ovoid's reader instead of the external site. A document wins over a bare
 * publication link. Null when there's no standard.site record (e.g. chat link
 * cards, which only have cardyb OG metadata) — caller falls back to the URL.
 */
function readerTarget(refs: { uri: string }[] | undefined): ReaderTarget | null {
  let pub: ReaderTarget | null = null
  for (const ref of refs ?? []) {
    const doc = /^at:\/\/([^/]+)\/site\.standard\.document\/(.+)$/.exec(ref.uri)
    if (doc) {
      return { path: `/read/${doc[1]}/${doc[2]}`, doc: { authority: doc[1], rkey: doc[2] } }
    }
    const p = /^at:\/\/([^/]+)\/site\.standard\.publication\/(.+)$/.exec(ref.uri)
    if (p && !pub) {
      pub = { path: `/pub/${p[1]}/site.standard.publication/${p[2]}`, pubUri: ref.uri }
    }
  }
  return pub
}

/**
 * External-link card. When the AppView attached standard.site metadata
 * (external.source / associatedProfiles / readingTime — the protocol's
 * enhanced-preview fields, resolved server-side from the linked site's
 * site.standard.publication + site.standard.document records), it renders an
 * enriched card: publication name + icon, author byline, reading time, and the
 * publication's accent colour. Otherwise it's the plain thumbnail/title card.
 *
 * standard.site links additionally route into Ovoid's own reader (via the
 * document's at-uri in associatedRefs) rather than out to the web.
 */
export function GenericExternalCard({ external }: ExternalEmbedProps) {
  const domain = hostname(external.uri)
  const source = external.source
  const authors = external.associatedProfiles ?? []
  const author = authors[0]
  const readingTime = external.readingTime
  const enhanced = !!source || !!author || !!readingTime
  const accent = cssRgb(source?.theme?.accentRGB)
  const target = readerTarget(external.associatedRefs)

  // In-app reader destinations warm on dwell like any other link card.
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    if (!target) return
    if (target.doc) {
      const doc = documentOptions(target.doc.authority, target.doc.rkey)
      schedulePrefetch(doc.queryKey, () => queryClient.prefetchQuery(doc))
    } else if (target.pubUri) {
      const rec = publicationRecordOptions(target.pubUri)
      schedulePrefetch(rec.queryKey, () => queryClient.prefetchQuery(rec))
      const docs = publicationDocsOptions(target.pubUri)
      schedulePrefetch(docs.queryKey, () => queryClient.prefetchQuery(docs))
    }
  })

  const className = clsx('embed embed--external', enhanced && 'embed--standard')
  const style = accent ? { borderLeftColor: accent } : undefined

  const inner = (
    <>
      {external.thumb && (
        <img className="embed-ext__thumb" src={external.thumb} alt="" loading="lazy" />
      )}
      <div className="embed-ext__body">
        {source ? (
          <div className="embed-ext__source" style={accent ? { color: accent } : undefined}>
            {source.icon && (
              <img className="embed-ext__source-icon" src={source.icon} alt="" loading="lazy" />
            )}
            <span>{source.title || domain}</span>
          </div>
        ) : (
          domain && <div className="embed-ext__domain">{domain}</div>
        )}

        <div className="embed-ext__title">{external.title || external.uri}</div>
        {external.description && <div className="embed-ext__desc">{external.description}</div>}

        {(author || readingTime) && (
          <div className="embed-ext__byline">
            {author?.avatar && (
              <img className="embed-ext__author-av" src={author.avatar} alt="" loading="lazy" />
            )}
            {author && (
              <span className="embed-ext__author">
                {author.displayName || `@${author.handle}`}
                {authors.length > 1 && ` +${authors.length - 1}`}
              </span>
            )}
            {readingTime ? <span className="embed-ext__meta">{readingTime} min read</span> : null}
          </div>
        )}
      </div>
    </>
  )

  // standard.site → open in our reader (in-app navigation).
  if (target) {
    return (
      <Link
        to={target.path}
        className={className}
        style={style}
        onClick={(e) => e.stopPropagation()}
        ref={prefetchRef}
      >
        {inner}
      </Link>
    )
  }

  return (
    <a
      className={className}
      href={external.uri}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={style}
    >
      {inner}
    </a>
  )
}
