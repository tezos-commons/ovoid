import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgent } from '@/lib/api/agent'
import { notifyConfigured } from '@/lib/notify/client'
import { syncPushRegistration } from '@/lib/notify/push'
import { runWhenIdle } from '@/lib/idle'
import { useUnreadCount } from './use-unread-count'

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/**
 * Push glue that must live where the router is mounted (RootLayout):
 *
 *  - routes service-worker `notificationclick` messages into in-app
 *    navigation (the SW posts {type:'navigate', url} to avoid a full reload
 *    when a window already exists);
 *  - mirrors the unread count onto the installed-app icon badge;
 *  - re-registers the push subscription if the browser rotated it while the
 *    app was closed (idle-deferred; no-ops without network when the endpoint
 *    is unchanged).
 */
export function usePushBoot() {
  const navigate = useNavigate()
  const { agent, isAuthed } = useAgent()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type !== 'navigate' || !data.url) return
      const url = new URL(data.url, location.origin)
      if (url.origin !== location.origin) return
      navigate(url.pathname + url.search)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  useEffect(() => {
    if (!isAuthed || !notifyConfigured()) return
    runWhenIdle(() => {
      void syncPushRegistration(agent).catch(() => {})
    })
  }, [isAuthed, agent])

  // Badge mirrors the bell count; the query is shared with the TopBar badge
  // (same key), so this adds no extra polling.
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
