import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@/components'
import { blobUrl } from '@/lib/api/repo-read'
import { schedulePrefetch } from '@/lib/prefetch'
import { queryClient } from '@/lib/query-client'
import {
  pubPath,
  profilePublicationsOptions,
  publicationRecordOptions,
  publicationDocsOptions,
} from '@/features/read/use-publication'

/**
 * Pinned to the top of a profile's Posts tab when the profile owns a
 * `site.standard.publication` record. Links to the publication's index page and
 * warms that route (record + article list) once the scan resolves, so the click
 * renders instantly. Renders nothing while the scan is in flight or finds no
 * record — profiles without a publication keep a clean feed.
 */
export function ProfilePublicationCard({ did }: { did: string }) {
  const q = useQuery({ ...profilePublicationsOptions(did), enabled: !!did })
  const pub = q.data?.[0]

  // The card resolves async (repo scan), so usePrefetchOnVisible — which binds
  // its observer on first render — can't see the link once it appears. Fire on
  // resolution instead; the card is pinned at the top, so the user is already
  // looking at it.
  useEffect(() => {
    if (!pub) return
    const rec = publicationRecordOptions(pub.uri)
    schedulePrefetch(rec.queryKey, () => queryClient.prefetchQuery(rec))
    const docs = publicationDocsOptions(pub.uri)
    schedulePrefetch(docs.queryKey, () => queryClient.prefetchQuery(docs))
  }, [pub?.uri])

  if (!pub) return null
  const href = pubPath(pub.uri)
  // listRecords returns at://<did>/<collection>/<rkey>, so pubPath always resolves.
  if (!href) return null
  const icon = pub.record.icon ? blobUrl(pub.pds, pub.did, pub.record.icon.ref.$link) : undefined

  return (
    <Link to={href} className="profcard">
      <Avatar
        src={icon}
        alt={pub.record.name}
        size="lg"
        shape="rounded-square"
        fallback={pub.record.name}
      />
      <div className="profcard__meta">
        <span className="profcard__name">{pub.record.name}</span>
        <span className="profcard__sub">Publication</span>
        {pub.record.description && <span className="profcard__desc">{pub.record.description}</span>}
      </div>
    </Link>
  )
}
