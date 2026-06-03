import { Link } from 'react-router-dom'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar } from '@/components'

export interface PersonCardProps {
  actor: AppBskyActorDefs.ProfileView | AppBskyActorDefs.ProfileViewBasic
  /** Compact form for the typeahead dropdown (no description, tighter padding). */
  compact?: boolean
  onNavigate?: () => void
}

/**
 * A user result row: avatar, name/handle, bio (full mode). The follow action is
 * intentionally not rendered here — follow lives in profile/use-follow and this
 * feature must not duplicate the optimistic mutation. Tapping the row routes to
 * the profile, which is where Follow is offered.
 */
export function PersonCard({ actor, compact = false, onNavigate }: PersonCardProps) {
  const to = `/profile/${actor.handle || actor.did}`
  const description =
    'description' in actor ? (actor as AppBskyActorDefs.ProfileView).description : undefined

  return (
    <Link
      to={to}
      className={compact ? 'personrow personrow--compact' : 'personrow'}
      onClick={onNavigate}
    >
      <Avatar src={actor.avatar} alt={actor.displayName || actor.handle} size={compact ? 'sm' : 'md'} />
      <div className="personrow__body">
        <div className="personrow__name">{actor.displayName || actor.handle}</div>
        <div className="personrow__handle">@{actor.handle}</div>
        {!compact && description && <div className="personrow__bio">{description}</div>}
      </div>
    </Link>
  )
}
