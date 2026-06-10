import { Link } from 'react-router-dom'
import type { AppBskyGraphDefs } from '@atproto/api'
import { Avatar, Button, Spinner } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { profileOptions } from '@/features/profile/use-profile'

interface MemberRowProps {
  item: AppBskyGraphDefs.ListItemView
  /** When true the viewer owns the list and may remove members. */
  canManage: boolean
  removing?: boolean
  onRemove?: (item: AppBskyGraphDefs.ListItemView) => void
}

/** A single list member: avatar, name/handle, bio, optional remove control. */
export function MemberRow({ item, canManage, removing, onRemove }: MemberRowProps) {
  const p = item.subject
  const { agent } = useAgent()
  const prefetchRef = usePrefetchOnVisible<HTMLDivElement>(() => {
    const opts = profileOptions(agent, p.handle || p.did)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
  })
  return (
    <div className="member-row" ref={prefetchRef}>
      <Avatar src={p.avatar} alt={p.displayName || p.handle} size="md" />
      <div className="member-row__body">
        <Link className="member-row__name" to={`/profile/${p.handle || p.did}`}>
          {p.displayName || p.handle}
        </Link>
        <div className="member-row__handle">@{p.handle}</div>
        {p.description && <div className="member-row__desc">{p.description}</div>}
      </div>
      {canManage && (
        <Button
          size="sm"
          variant="secondary"
          disabled={removing}
          onClick={() => onRemove?.(item)}
        >
          {removing ? <Spinner size="sm" /> : 'Remove'}
        </Button>
      )}
    </div>
  )
}
