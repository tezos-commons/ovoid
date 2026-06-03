import clsx from 'clsx'
import type { AppBskyEmbedExternal } from '@atproto/api'

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

/**
 * External-link card. When the AppView attached standard.site metadata
 * (external.source / associatedProfiles / readingTime — the protocol's
 * enhanced-preview fields, resolved server-side from the linked site's
 * site.standard.publication + site.standard.document records), it renders an
 * enriched card: publication name + icon, author byline, reading time, and the
 * publication's accent colour. Otherwise it's the plain thumbnail/title card.
 */
export function GenericExternalCard({ external }: ExternalEmbedProps) {
  const domain = hostname(external.uri)
  const source = external.source
  const authors = external.associatedProfiles ?? []
  const author = authors[0]
  const readingTime = external.readingTime
  const enhanced = !!source || !!author || !!readingTime
  const accent = cssRgb(source?.theme?.accentRGB)

  return (
    <a
      className={clsx('embed embed--external', enhanced && 'embed--standard')}
      href={external.uri}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
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
        {external.description && (
          <div className="embed-ext__desc">{external.description}</div>
        )}

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
            {readingTime ? (
              <span className="embed-ext__meta">{readingTime} min read</span>
            ) : null}
          </div>
        )}
      </div>
    </a>
  )
}
