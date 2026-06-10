import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import { useAuth } from '@/lib/api/agent'

export function BottomTabBar() {
  const { did, isAuthed } = useAuth()
  const items = NAV_ITEMS.filter((i) => i.mobile)

  return (
    <nav className="bottombar" aria-label="Primary">
      {items.map((item) => {
        // Signed out: authed-only items go to login (profile's "me" would
        // otherwise resolve to an invalid getProfile).
        const to =
          item.authed && !isAuthed
            ? '/login'
            : item.key === 'profile' && did
              ? `/profile/${did}`
              : item.to
        return (
          <NavLink
            key={item.key}
            to={to}
            end={item.to === '/'}
            className={({ isActive }) => clsx('bottombar__item', isActive && 'bottombar__item--active')}
            aria-label={item.label}
          >
            {({ isActive }) => item.icon(isActive)}
          </NavLink>
        )
      })}
    </nav>
  )
}
