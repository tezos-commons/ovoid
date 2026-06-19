import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Img, ErrorState, EmptyState } from '@/components'
import { absoluteTime } from '@/lib/time'
import { blobUrl } from '@/lib/api/repo-read'
import { schedulePrefetch } from '@/lib/prefetch'
import { queryClient } from '@/lib/query-client'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { documentOptions } from './use-document'
import { ReaderTopBar } from './ReaderTopBar'
import { ReadingSettings } from './ReadingSettings'
import { SubscribeButton } from './SubscribeButton'
import { DocListSkeleton } from './read-skeletons'
import { useShareMeta } from './read-meta'
import {
  usePublicationRecord,
  usePublicationDocs,
  type PublicationView,
  type PublicationDoc,
} from './use-publication'
import './reader.css'

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** True for Ovoid-hosted publications — their `url` is our own canonical, not an
 *  external source, so the "Source" badge is pointless. */
function isOvoidHosted(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return h === 'ovoid.at' || h.endsWith('.ovoid.at')
  } catch {
    return false
  }
}

/**
 * Public publication index — /pub/<did>/<collection>/<rkey>. Lists every article
 * in the publication (newest first, grouped by year) and surfaces the
 * publication's own website as its labelled source.
 */
export default function PublicationScreen() {
  const { did, collection, rkey } = useParams<{ did: string; collection: string; rkey: string }>()
  const pubUri = did && collection && rkey ? `at://${did}/${collection}/${rkey}` : ''

  const rec = usePublicationRecord(pubUri)
  const docs = usePublicationDocs(pubUri)

  const r = rec.data
  const icon = r?.record.icon ? blobUrl(r.pds, r.did, r.record.icon.ref.$link) : undefined
  useShareMeta(r ? { title: r.record.name, description: r.record.description, image: icon } : undefined)

  return (
    <div className="rdr">
      <ReaderTopBar />
      <main className="rdr-main">
        {rec.isError ? (
          <ErrorState error={rec.error} title="Couldn’t load this publication" onRetry={() => rec.refetch()} />
        ) : (
          <>
            <PublicationHeader view={r} icon={icon} pubUri={pubUri} count={docs.data?.length} />
            {docs.isLoading ? (
              <DocListSkeleton />
            ) : (docs.data?.length ?? 0) === 0 ? (
              <EmptyState title="No articles yet" message="This publication hasn’t published anything." />
            ) : (
              <DocList docs={docs.data ?? []} />
            )}
          </>
        )}
      </main>
      <ReadingSettings />
    </div>
  )
}

function PublicationHeader({
  view,
  icon,
  pubUri,
  count,
}: {
  view: PublicationView | undefined
  icon: string | undefined
  pubUri: string
  count: number | undefined
}) {
  if (!view) {
    // Header placeholder while the record loads (docs skeleton shows below).
    return <header className="rdr-pubhead rdr-pubhead--loading" aria-hidden="true" />
  }
  const { record, did } = view
  return (
    <header className="rdr-pubhead">
      {record.url && !isOvoidHosted(record.url) && (
        <a className="rdr-pubhead__source" href={record.url} target="_blank" rel="noopener noreferrer">
          <span className="rdr-pubhead__source-label">Source</span>
          <span className="rdr-pubhead__source-host">{host(record.url)} ↗</span>
        </a>
      )}

      <div className="rdr-pubhead__main">
        {icon && (
          <Link to={`/profile/${did}`} className="rdr-pubhead__icon" aria-label="View profile">
            <Img src={icon} alt="" />
          </Link>
        )}
        <div className="rdr-pubhead__body">
          <h1 className="rdr-pubhead__name">{record.name}</h1>
          {record.description && <p className="rdr-pubhead__desc">{record.description}</p>}
          {count != null && (
            <p className="rdr-pubhead__count">
              {count} {count === 1 ? 'article' : 'articles'}
            </p>
          )}
        </div>
        <div className="rdr-pubhead__action">
          <SubscribeButton pubUri={pubUri} />
        </div>
      </div>
    </header>
  )
}

function useDocPrefetch(did: string, rkey: string) {
  return usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const opts = documentOptions(did, rkey)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
  })
}

function DocLink({ doc, className, children }: { doc: PublicationDoc; className: string; children: ReactNode }) {
  const ref = useDocPrefetch(doc.did, doc.rkey)
  return (
    <Link ref={ref} to={`/read/${doc.did}/${doc.rkey}`} className={className}>
      {children}
    </Link>
  )
}

function year(iso: string): string {
  const y = new Date(iso).getFullYear()
  return Number.isNaN(y) ? '' : String(y)
}

function DocList({ docs }: { docs: PublicationDoc[] }) {
  const [featured, ...rest] = docs

  // Group the remainder by year, preserving newest-first order.
  const groups: { year: string; docs: PublicationDoc[] }[] = []
  for (const d of rest) {
    const y = year(d.publishedAt)
    const last = groups[groups.length - 1]
    if (last && last.year === y) last.docs.push(d)
    else groups.push({ year: y, docs: [d] })
  }

  return (
    <div className="rdr-pubdocs">
      {featured && (
        <DocLink doc={featured} className="rdr-featured">
          <span className="rdr-featured__kicker">Latest</span>
          <span className="rdr-featured__title">{featured.title}</span>
          {featured.description && <p className="rdr-featured__desc">{featured.description}</p>}
          <time className="rdr-doclist__date" dateTime={featured.publishedAt}>
            {absoluteTime(featured.publishedAt, { year: 'numeric' })}
          </time>
        </DocLink>
      )}

      {groups.map((g) => (
        <section key={g.year || 'undated'} className="rdr-pubyear">
          {g.year && <h2 className="rdr-pubyear__label">{g.year}</h2>}
          <ul className="rdr-doclist">
            {g.docs.map((d) => (
              <li key={d.uri}>
                <DocLink doc={d} className="rdr-doclist__item">
                  <span className="rdr-doclist__title">{d.title}</span>
                  {d.description && <p className="rdr-doclist__desc">{d.description}</p>}
                  <time className="rdr-doclist__date" dateTime={d.publishedAt}>
                    {absoluteTime(d.publishedAt, { year: 'numeric' })}
                  </time>
                </DocLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
