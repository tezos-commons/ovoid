import type { ReactNode } from 'react'
import {
  HomeIcon,
  SearchIcon,
  BellIcon,
  ChatIcon,
  HashIcon,
  ListIcon,
  PersonIcon,
  GearIcon,
} from '../Icon'

export interface NavItem {
  key: string
  to: string
  label: string
  icon: (active: boolean) => ReactNode
  /** Show in the mobile bottom bar. */
  mobile?: boolean
  /**
   * Destination requires a session. When signed out the nav points it at
   * /login instead of its route — notably profile, whose route would otherwise
   * resolve the placeholder "me" into an invalid getProfile call.
   */
  authed?: boolean
}

/** Shared nav definition used by both TopBar and BottomTabBar. */
export const NAV_ITEMS: NavItem[] = [
  { key: 'home', to: '/', label: 'Home', mobile: true, authed: true, icon: (a) => <HomeIcon filled={a} /> },
  { key: 'search', to: '/search', label: 'Search', mobile: true, icon: () => <SearchIcon /> },
  {
    key: 'notifications',
    to: '/notifications',
    label: 'Notifications',
    mobile: true,
    authed: true,
    icon: (a) => <BellIcon filled={a} />,
  },
  { key: 'chat', to: '/messages', label: 'Chat', mobile: true, authed: true, icon: (a) => <ChatIcon filled={a} /> },
  { key: 'feeds', to: '/feeds', label: 'Feeds', icon: () => <HashIcon /> },
  { key: 'lists', to: '/lists', label: 'Lists', icon: () => <ListIcon /> },
  {
    key: 'profile',
    to: '/profile/me',
    label: 'Profile',
    mobile: true,
    authed: true,
    icon: (a) => <PersonIcon filled={a} />,
  },
  { key: 'settings', to: '/settings', label: 'Settings', authed: true, icon: () => <GearIcon /> },
]
