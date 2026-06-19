import { Avatar, type AvatarProps } from './Avatar'

export interface AvatarGroupMember {
  did: string
  avatar?: string
  displayName?: string
  handle?: string
}

export interface AvatarGroupProps {
  members: readonly AvatarGroupMember[]
  /** Max avatars shown before collapsing the rest into a +N chip. */
  max?: number
  size?: AvatarProps['size']
  /**
   * Authoritative total member count. Group convos expose only a partial
   * "important members" roster, so `members.length` undercounts; pass the real
   * total (e.g. `groupConvo.memberCount`) and the overflow chip is counted
   * against it. Omit when the roster is the complete membership.
   */
  total?: number
}

/**
 * Overlapping stack of member avatars for group convos. Mirrors the single
 * `Avatar` used for 1:1 rows so the list/header layout stays consistent; the
 * stack just replaces the lone avatar. Overflow beyond `max` collapses to "+N",
 * counted against `total` when given (the roster may be partial) else the roster.
 */
export function AvatarGroup({ members, max = 3, size = 'md', total }: AvatarGroupProps) {
  const shown = members.slice(0, max)
  const overflow = Math.max(0, (total ?? members.length) - shown.length)

  return (
    <span className={`avatar-group avatar-group--${size}`}>
      {shown.map((m) => (
        <span className="avatar-group__item" key={m.did}>
          <Avatar
            src={m.avatar}
            alt={m.displayName ?? m.handle}
            fallback={m.displayName ?? m.handle}
            size={size}
          />
        </span>
      ))}
      {overflow > 0 && (
        <span className="avatar-group__item avatar-group__more" aria-label={`${overflow} more`}>
          +{overflow}
        </span>
      )}
    </span>
  )
}
