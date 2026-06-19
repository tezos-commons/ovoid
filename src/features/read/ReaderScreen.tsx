import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, Img, ErrorState, EmptyState } from '@/components'
import { ShareIcon } from '@/components/Icon'
import { shareArticle } from './embeddable-url'
import { absoluteTime } from '@/lib/time'
import { blobUrl } from '@/lib/api/repo-read'
import { useDocument, type DocumentView } from './use-document'
import { isLeafletContent } from './leaflet'
import { LeafletContent } from './LeafletContent'
import { MarkdownContent } from './MarkdownContent'
import { PublicationCard } from './PublicationCard'
import { ReaderTopBar } from './ReaderTopBar'
import { ReadingSettings } from './ReadingSettings'
import { ReadingProgress } from './ReadingProgress'
import { ReaderSkeleton } from './read-skeletons'
import { Toc, useTocHeadings } from './Toc'
import { readingMinutes } from './reading-time'
import { useShareMeta } from './read-meta'
import './reader.css'

/** Extract inline GFM from `at.markpub.markdown` content, if that's the shape. */
function markpubMarkdown(content: { $type: string } & Record<string, unknown>): string | null {
  if (content.$type !== 'at.markpub.markdown') return null
  const md = (content.text as { markdown?: unknown } | undefined)?.markdown
  return typeof md === 'string' ? md : null
}

/**
 * Public, standalone reader for a `site.standard.document` — ovoid.at/read/<did
 * or handle>/<rkey>. Rendered OUTSIDE the app shell (a public route, no
 * RequireAuth), so it works signed out and never touches the beta/list gate.
 *
 * at:// documents with Leaflet content render in full; loose https documents
 * (or content we can't render) fall back to a link to the original.
 */
export default function ReaderScreen() {
  const { authority, rkey } = useParams<{ authority: string; rkey: string }>()
  const { data, isLoading, isError, error, refetch } = useDocument(authority, rkey)

  const cover =
    data?.doc.coverImage && data
      ? blobUrl(data.pds, data.did, data.doc.coverImage.ref.$link)
      : undefined
  useShareMeta(
    data
      ? { title: data.doc.title, description: data.doc.description, image: cover }
      : undefined,
  )

  return (
    <div className="rdr">
      <ReaderTopBar />
      {data && <ReadingProgress />}
      <main className="rdr-main">
        {isLoading ? (
          <ReaderSkeleton />
        ) : isError ? (
          <ErrorState error={error} title="Couldn’t load this article" onRetry={() => refetch()} />
        ) : !data ? (
          <EmptyState title="Article not found" message="This document doesn’t exist or was removed." />
        ) : (
          <Article view={data} />
        )}
      </main>
      <ReadingSettings />
    </div>
  )
}

function Article({ view }: { view: DocumentView }) {
  const { doc, author, did, pds } = view
  const cover = doc.coverImage ? blobUrl(pds, did, doc.coverImage.ref.$link) : null
  const authorName = author?.displayName || author?.handle
  // Internal Ovoid profile (handle preferred, DID as fallback).
  const profilePath = `/profile/${author?.handle || did}`
  const minutes = readingMinutes(view)

  const bodyRef = useRef<HTMLDivElement>(null)
  const headings = useTocHeadings(bodyRef, view.uri)

  return (
    <>
      <Toc headings={headings} />
      <article className="rdr-article">
        <PublicationCard view={view} />

        {cover && (
          <div className="rdr-cover">
            <Img src={cover} alt="" />
          </div>
        )}

        <h1 className="rdr-title">{doc.title}</h1>

        <div className="rdr-byline">
          {author && (
            <Link to={profilePath} className="rdr-byline__avatar">
              <Avatar src={author.avatar} alt={authorName ?? ''} size="sm" fallback={authorName} />
            </Link>
          )}
          <div className="rdr-byline__meta">
            {authorName && <Link to={profilePath}>{authorName}</Link>}
            <span className="rdr-byline__sub">
              <time dateTime={doc.publishedAt}>{absoluteTime(doc.publishedAt, { year: 'numeric' })}</time>
              {minutes > 0 && <span className="rdr-dot"> · {minutes} min read</span>}
            </span>
          </div>
          <button
            type="button"
            className="rdr-share"
            aria-label="Share"
            onClick={() => void shareArticle(view)}
          >
            <ShareIcon size={18} />
          </button>
        </div>

        <div ref={bodyRef}>
          <Body view={view} />
        </div>

        {doc.tags && doc.tags.length > 0 && (
          <ul className="rdr-tags">
            {doc.tags.map((t) => (
              <li key={t}>#{t}</li>
            ))}
          </ul>
        )}
      </article>
    </>
  )
}

/**
 * at:// Leaflet content → full render. Everything else (metadata-only docs whose
 * body lives on the external site, unrecognized content types) → the excerpt
 * plus a link to the original.
 */
function Body({ view }: { view: DocumentView }) {
  const { doc, canonicalUrl, did, pds } = view

  if (isLeafletContent(doc.content)) {
    return <LeafletContent content={doc.content} pds={pds} did={did} />
  }

  const markdown = doc.content && markpubMarkdown(doc.content)
  if (markdown) {
    return <MarkdownContent markdown={markdown} />
  }

  // No embedded body. `textContent` is plaintext by spec; `description` may carry
  // markdown (links/emphasis), so render it through the markdown renderer.
  return (
    <>
      {doc.description ? (
        <MarkdownContent markdown={doc.description} />
      ) : doc.textContent ? (
        <div className="rdr-body">
          <p className="rdr-lede">{doc.textContent}</p>
        </div>
      ) : null}
      <div className="rdr-body">
        <p className="rdr-external">
          {canonicalUrl ? (
            <a href={canonicalUrl} target="_blank" rel="noopener noreferrer" className="rdr-external__link">
              Read the full article ↗
            </a>
          ) : (
            <span className="rdr-external__none">No readable content for this document.</span>
          )}
        </p>
      </div>
    </>
  )
}
