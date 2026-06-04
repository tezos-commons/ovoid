import { Link } from 'react-router-dom'
import type { AppBskyGraphDefs } from '@atproto/api'
import { Avatar } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { PurposeChip } from './PurposeChip'
import { listPermalink } from './list-uri'
import { prefetchListFromView } from './use-list'

interface ListCardProps {
  list: AppBskyGraphDefs.ListView
}

/** Index card for a single list: square avatar, name + purpose chip, creator, description, count. */
export function ListCard({ list }: ListCardProps) {
  const to = listPermalink(list.uri, list.creator.handle || list.creator.did)
  const count = list.listItemCount ?? 0
  const { agent, did } = useAgent()
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() =>
    prefetchListFromView(agent, did, list),
  )
  return (
    <Link ref={prefetchRef} className="list-card" to={to}>
      <Avatar
        src={list.avatar}
        alt={list.name}
        size="lg"
        shape="rounded-square"
        fallback={list.name}
      />
      <div className="list-card__body">
        <div className="list-card__name">
          <span>{list.name}</span>
          <PurposeChip purpose={list.purpose} />
        </div>
        <div className="list-card__by">
          by @{list.creator.handle || list.creator.did}
        </div>
        {list.description && <div className="list-card__desc">{list.description}</div>}
        <div className="list-card__meta">
          {count} {count === 1 ? 'user' : 'users'}
        </div>
      </div>
    </Link>
  )
}
