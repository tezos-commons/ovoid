import { useInfiniteQuery } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { convosOptions } from '@/features/chat/use-convos'
import { useUnreadCount } from './use-unread-count'

export interface NavBadges {
  /** Unseen notification count (bell). */
  notifications: number
  /** Sum of unread messages across non-muted convos (chat). */
  chat: number
}

/**
 * Counts for the primary-nav badges. Both reads are the SAME queries the
 * destination screens use (qk.unreadCount / qk.convos), so the badges add no
 * new cache entries — only observers. The convo observer polls at a relaxed
 * 60s; when the messages screen is open its own 15s observer drives the query
 * (TanStack refetches at the fastest interval among observers).
 */
export function useNavBadges(): NavBadges {
  const { chatAgent, did, isAuthed } = useAgent()
  const notifications = useUnreadCount().data ?? 0

  // chatAgent is null signed-out; the cast is safe because `enabled` gates the
  // queryFn (the only closure over it) on its presence.
  const { data: chat } = useInfiniteQuery({
    ...convosOptions(chatAgent as Agent, did),
    enabled: isAuthed && !!chatAgent,
    refetchInterval: 60_000,
    select: (data) =>
      data.pages
        .flatMap((p) => p.convos)
        .reduce((sum, c) => (c.muted ? sum : sum + (c.unreadCount ?? 0)), 0),
  })

  return { notifications, chat: chat ?? 0 }
}
