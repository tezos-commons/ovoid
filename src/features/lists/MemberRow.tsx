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
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const opts = profileOptions(agent, p.handle || p.did)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
  })
  return (
    // Whole row navigates to the profile; the Remove control stops the click.
    <Link className="member-row" to={`/profile/${p.handle || p.did}`} ref={prefetchRef}>
      <Avatar src={p.avatar} alt={p.displayName || p.handle} size="md" />
      <div className="member-row__body">
        <span className="member-row__name">{p.displayName || p.handle}</span>
        <div className="member-row__handle">@{p.handle}</div>
        {p.description && <div className="member-row__desc">{p.description}</div>}
      </div>
      {canManage && (
        <Button
          size="sm"
          variant="secondary"
          disabled={removing}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove?.(item)
          }}
        >
          {removing ? <Spinner size="sm" /> : 'Remove'}
        </Button>
      )}
    </Link>
  )
}
