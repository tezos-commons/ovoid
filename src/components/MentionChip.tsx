import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from './Avatar'
import { ProfileHoverCard } from './ProfileHoverCard'
import { useAgent } from '@/lib/api/agent'
import { profileOptions } from '@/features/profile/use-profile'

export interface MentionChipProps {
  /** Handle (from locally-detected bio facets) or DID (from server facets). */
  actor: string
  /** The original "@handle" text — shown until the profile resolves. */
  text: string
}

/**
 * Inline @-mention rendered as a tiny profile chip: avatar + display name,
 * linking to the profile. The profile is resolved from the shared query cache
 * (deduped, stale-while-revalidate); until it loads — or if it can't resolve —
 * it degrades to the plain "@handle" link so it's never broken or empty. Used in
 * bios and chat messages.
 */
export function MentionChip({ actor, text }: MentionChipProps) {
  const { agent } = useAgent()
  const { data } = useQuery(profileOptions(agent, actor))
  const to = `/profile/${actor}`

  if (!data) {
    return (
      <ProfileHoverCard actor={actor}>
        <Link to={to} className="rt-link">
          {text}
        </Link>
      </ProfileHoverCard>
    )
  }
  return (
    <ProfileHoverCard actor={actor}>
      <Link to={to} className="mention-chip">
        <Avatar src={data.avatar} alt="" fallback={data.displayName || data.handle} size="xs" />
        <span className="mention-chip__name">{data.displayName || `@${data.handle}`}</span>
      </Link>
    </ProfileHoverCard>
  )
}
