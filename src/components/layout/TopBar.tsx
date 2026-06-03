import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import { Button } from '../Button'
import { PencilIcon } from '../Icon'
import { useAuth } from '@/lib/api/agent'

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
  const { did } = useAuth()

  return (
    <header className="topbar">
      <div className="topbar__brand">Ovoid</div>

      <nav className="topbar__nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          // Profile resolves to the viewer's own DID when signed in.
          const to = item.key === 'profile' && did ? `/profile/${did}` : item.to
          return (
            <NavLink
              key={item.key}
              to={to}
              end={item.to === '/'}
              className={({ isActive }) => clsx('topbar__item', isActive && 'topbar__item--active')}
              title={item.label}
              aria-label={item.label}
            >
              {({ isActive }) => item.icon(isActive)}
            </NavLink>
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
