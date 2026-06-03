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
}

/** Shared nav definition used by both TopBar and BottomTabBar. */
export const NAV_ITEMS: NavItem[] = [
  { key: 'home', to: '/', label: 'Home', mobile: true, icon: (a) => <HomeIcon filled={a} /> },
  { key: 'search', to: '/search', label: 'Search', mobile: true, icon: () => <SearchIcon /> },
  {
    key: 'notifications',
    to: '/notifications',
    label: 'Notifications',
    mobile: true,
    icon: (a) => <BellIcon filled={a} />,
  },
  { key: 'chat', to: '/messages', label: 'Chat', mobile: true, icon: (a) => <ChatIcon filled={a} /> },
  { key: 'feeds', to: '/feeds', label: 'Feeds', icon: () => <HashIcon /> },
  { key: 'lists', to: '/lists', label: 'Lists', icon: () => <ListIcon /> },
  {
    key: 'profile',
    to: '/profile/me',
    label: 'Profile',
    mobile: true,
    icon: (a) => <PersonIcon filled={a} />,
  },
  { key: 'settings', to: '/settings', label: 'Settings', icon: () => <GearIcon /> },
]
