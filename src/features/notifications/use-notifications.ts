import { useInfiniteQuery } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import type {
  AppBskyNotificationListNotifications,
} from '@atproto/api'

export type Notification =
  AppBskyNotificationListNotifications.Notification

export type NotifReason =
  | 'like'
  | 'repost'
  | 'follow'
  | 'mention'
  | 'reply'
  | 'quote'
  | 'starterpack-joined'
  | 'like-via-repost'
  | 'repost-via-repost'
  | (string & {})

/** Filter applied client-side by the active tab. */
export type NotifFilter = 'all' | 'mentions'

const PAGE_LIMIT = 50

/**
 * listNotifications, paginated. The viewer DID scopes the cache key so account
 * switches invalidate cleanly. We over-fetch (limit 50) because grouping
 * collapses many like/repost rows into one cluster — a small page would render
 * as a near-empty screen after clustering.
 *
 * We deliberately do NOT pass `seenAt` here: marking-seen is a side effect of
 * viewing (use-update-seen), and threading it through the query key would
 * refetch the whole list every time the badge clears.
 */
export function useNotifications() {
  const { agent, did, isAuthed } = useAgent()
  return useInfiniteQuery({
    queryKey: qk.notifications(did),
    enabled: isAuthed,
    queryFn: ({ pageParam }) =>
      agent.app.bsky.notification
        .listNotifications({ cursor: pageParam, limit: PAGE_LIMIT })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    staleTime: 30_000,
  })
}
