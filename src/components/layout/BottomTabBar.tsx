import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import { useAuth } from '@/lib/api/agent'

export function BottomTabBar() {
  const { did } = useAuth()
  const items = NAV_ITEMS.filter((i) => i.mobile)

  return (
    <nav className="bottombar" aria-label="Primary">
      {items.map((item) => {
        const to = item.key === 'profile' && did ? `/profile/${did}` : item.to
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
