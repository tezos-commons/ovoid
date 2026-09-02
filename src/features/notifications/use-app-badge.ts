import { useEffect } from 'react'
import { useUnreadCount } from './use-unread-count'

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/**
 * Mirrors the unread notification count onto the installed-app icon badge.
 * The query is shared with the TopBar badge (same key), so this adds no extra
 * polling.
 */
export function useAppBadge() {
  const { data: unread } = useUnreadCount()
  useEffect(() => {
    const nav = navigator as BadgeNavigator
    if (!nav.setAppBadge) return
    if (unread && unread > 0) {
      void nav.setAppBadge(unread).catch(() => {})
    } else {
      void nav.clearAppBadge?.().catch(() => {})
    }
  }, [unread])
}
