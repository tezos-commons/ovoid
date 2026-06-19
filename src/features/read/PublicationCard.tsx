import { Link } from 'react-router-dom'
import { Img } from '@/components'
import { blobUrl } from '@/lib/api/repo-read'
import { schedulePrefetch } from '@/lib/prefetch'
import { queryClient } from '@/lib/query-client'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import type { DocumentView } from './use-document'
import { pubPath, publicationRecordOptions, publicationDocsOptions } from './use-publication'
import { SubscribeButton } from './SubscribeButton'

/**
 * Publication header on an article: the publication's icon / name / description
 * (linking to its index page) plus a subscribe toggle. Rendered only for at://
 * publications (a resolved `view.publication`).
 */
export function PublicationCard({ view }: { view: DocumentView }) {
  const pubUri = view.doc.site
  // Warm the publication index (record + article list) before the click.
  const prefetchRef = usePrefetchOnVisible<HTMLElement>(() => {
    const rec = publicationRecordOptions(pubUri)
    schedulePrefetch(rec.queryKey, () => queryClient.prefetchQuery(rec))
    const docs = publicationDocsOptions(pubUri)
    schedulePrefetch(docs.queryKey, () => queryClient.prefetchQuery(docs))
  })

  if (!view.publication) return null
  const { record, pds, did } = view.publication
  const icon = record.icon ? blobUrl(pds, did, record.icon.ref.$link) : null
  const href = pubPath(pubUri)

  const name = href ? <Link to={href}>{record.name}</Link> : record.name

  return (
    <aside className="rdr-pub" ref={prefetchRef}>
      {icon &&
        (href ? (
          <Link to={href} className="rdr-pub__icon">
            <Img src={icon} alt="" />
          </Link>
        ) : (
          <div className="rdr-pub__icon">
            <Img src={icon} alt="" />
          </div>
        ))}
      <div className="rdr-pub__body">
        <div className="rdr-pub__name">{name}</div>
        {record.description && <p className="rdr-pub__desc">{record.description}</p>}
      </div>
      <div className="rdr-pub__action">
        <SubscribeButton pubUri={view.doc.site} />
      </div>
    </aside>
  )
}
