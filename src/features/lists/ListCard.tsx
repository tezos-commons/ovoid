import { Link } from 'react-router-dom'
import type { AppBskyGraphDefs } from '@atproto/api'
import { Avatar } from '@/components'
import { PurposeChip } from './PurposeChip'
import { listPermalink } from './list-uri'

interface ListCardProps {
  list: AppBskyGraphDefs.ListView
}

/** Index card for a single list: square avatar, name + purpose chip, creator, description, count. */
export function ListCard({ list }: ListCardProps) {
  const to = listPermalink(list.uri, list.creator.handle || list.creator.did)
  const count = list.listItemCount ?? 0
  return (
    <Link className="list-card" to={to}>
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
