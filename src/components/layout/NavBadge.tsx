/**
 * Count bubble pinned to a primary-nav icon (bell / chat). Renders nothing at
 * zero — absence is the "all caught up" state, not a grey badge.
 */
export function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="navbadge" aria-label={`${count} unread`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
