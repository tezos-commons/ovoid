import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import { Button } from '../Button'
import { Tooltip } from '../Tooltip'
import { PencilIcon } from '../Icon'
import { useAuth } from '@/lib/api/agent'
import { useNavBadges } from '@/features/notifications/use-nav-badges'
import { NavBadge } from './NavBadge'

export interface TopBarProps {
  /** Open the global compose modal. */
  onNewPost?: () => void
}

/**
 * Primary navigation as a sticky top bar: brand on the left, the full nav set as
 * centered icon links, and New Post on the right. Desktop only — below the
 * mobile breakpoint it hides in favor of the BottomTabBar (see layout.css).
 */
export function TopBar({ onNewPost }: TopBarProps) {
  const { did, isAuthed } = useAuth()
  const badges = useNavBadges()

  return (
    <header className="topbar">
      <div className="topbar__brand">Ovoid</div>

      <nav className="topbar__nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          // Signed out: authed-only items go to login (profile's "me" would
          // otherwise resolve to an invalid getProfile). Signed in: profile
          // resolves to the viewer's own DID.
          const to =
            item.authed && !isAuthed
              ? '/login'
              : item.key === 'profile' && did
                ? `/profile/${did}`
                : item.to
          return (
            <Tooltip key={item.key} label={item.label}>
              <NavLink
                to={to}
                end={item.to === '/'}
                className={({ isActive }) => clsx('topbar__item', isActive && 'topbar__item--active')}
                aria-label={item.label}
              >
                {({ isActive }) => (
                  <>
                    {item.icon(isActive)}
                    {item.key === 'notifications' && <NavBadge count={badges.notifications} />}
                    {item.key === 'chat' && <NavBadge count={badges.chat} />}
                  </>
                )}
              </NavLink>
            </Tooltip>
          )
        })}
      </nav>

      <div className="topbar__actions">
        <Button variant="primary" icon={<PencilIcon size={18} />} onClick={onNewPost}>
          New Post
        </Button>
      </div>
    </header>
  )
}
