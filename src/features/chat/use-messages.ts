import { useCallback, useEffect, useMemo } from 'react'
import {
  useInfiniteQuery,
  useQueryClient,
  infiniteQueryOptions,
  type InfiniteData,
} from '@tanstack/react-query'
import type { Agent, ChatBskyConvoDefs, ChatBskyConvoGetMessages } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

export type MessageItem =
  | ChatBskyConvoDefs.MessageView
  | ChatBskyConvoDefs.DeletedMessageView
  | ChatBskyConvoDefs.SystemMessageView

type Page = ChatBskyConvoGetMessages.OutputSchema
export type MessagesData = InfiniteData<Page, string | undefined>

/**
 * Just-sent messages awaiting server visibility, per convo. The chat backend
 * indexes a sent message asynchronously (notably slower for groups, with their
 * fan-out), so the 6s head-page poll can return WITHOUT a message you just sent
 * — which would overwrite the optimistic bubble and make it vanish until the
 * convo is reopened. We hold sent messages here and re-merge them into every
 * head fetch until the server itself returns them (matched by id), then drop them.
 */
const pendingSent = new Map<string, ChatBskyConvoDefs.MessageView[]>()

export function recordPendingSent(convoId: string, msg: ChatBskyConvoDefs.MessageView): void {
  const cur = pendingSent.get(convoId) ?? []
  if (cur.some((m) => m.id === msg.id)) return
  pendingSent.set(convoId, [msg, ...cur])
}

/** Merge still-pending sent messages into a freshly-fetched head page. */
function mergePendingHead(convoId: string, page: Page): Page {
  const pend = pendingSent.get(convoId)
  if (!pend || pend.length === 0) return page
  const presentIds = new Set(page.messages.map((m) => (m as ChatBskyConvoDefs.MessageView).id))
  const stillPending = pend.filter((m) => !presentIds.has(m.id))
  if (stillPending.length === 0) {
    pendingSent.delete(convoId)
    return page
  }
  pendingSent.set(convoId, stillPending)
  // getMessages is newest-first; our pending are the newest, so they go in front.
  // Stamp the discriminant so each matches the page's $Typed union.
  const typed = stillPending.map((m) => ({ $type: 'chat.bsky.convo.defs#messageView', ...m }))
  return { ...page, messages: [...typed, ...page.messages] }
}

/**
 * Shared infinite-query config for a convo's messages, consumed by both
 * `useMessages` and the convo-list prefetcher. `refetchInterval` only applies to
 * mounted observers, so prefetching warms the head page without starting a poll.
 */
export function messagesOptions(chatAgent: Agent, convoId: string) {
  return infiniteQueryOptions({
    queryKey: qk.messages(convoId),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const { data } = await chatAgent.chat.bsky.convo.getMessages({
        convoId,
        cursor: pageParam,
        limit: 50,
      })
      // Only the head fetch (no cursor) carries the newest window; merge pending
      // there so a send isn't dropped by a poll that raced the backend index.
      return pageParam === undefined ? mergePendingHead(convoId, data) : data
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    // staleTime matches the poll: the interval already bounds staleness, so a
    // shorter value only bought redundant refetches on remount between ticks.
    refetchInterval: 6_000,
    staleTime: 6_000,
  })
}

/**
 * Paged + polled message history for one convo.
 *
 * getMessages returns messages NEWEST-FIRST and the cursor pages BACKWARD in
 * time. So pages[0] is the newest window and the cursor walks toward older
 * history — "next page" here means "older messages" (loaded as you scroll up).
 *
 * Polling: re-fetches the first page on an interval to pull in inbound
 * messages. Because page 0 is the head (no cursor), refetchInterval naturally
 * refreshes the newest window.
 */
export function useMessages(convoId: string | undefined) {
  const { chatAgent, isAuthed } = useAgent()
  const enabled = isAuthed && !!chatAgent && !!convoId

  // Spread the shared factory so the hook and the convo-list prefetcher can
  // never drift on key or config. chatAgent! is safe: without one, `enabled`
  // is false and the queryFn never runs.
  const query = useInfiniteQuery({
    ...messagesOptions(chatAgent!, convoId ?? ''),
    enabled,
  })

  // Flattened oldest-first for natural top-to-bottom rendering. Each page is
  // newest-first; later pages are older — so reverse pages and items. Memoized
  // on the cache entry: the 6s poll usually returns identical data, and a fresh
  // array here would defeat MessageBubble's memo for the whole thread.
  const messages: MessageItem[] = useMemo(
    () =>
      query.data?.pages
        .flatMap((p) => p.messages as MessageItem[])
        .slice()
        .reverse() ?? [],
    [query.data],
  )

  return { ...query, messages }
}

/**
 * Imperatively prepend a just-sent message into the head page so the optimistic
 * send shows instantly without waiting for the next poll. Lives here because it
 * must understand the page ordering invariant above (head page, newest-first).
 */
export function usePrependSentMessage(convoId: string) {
  const qc = useQueryClient()
  return useCallback(
    (msg: ChatBskyConvoDefs.MessageView) => {
      // Hold it as pending so the next poll (which may race the backend index)
      // re-merges it instead of dropping it.
      recordPendingSent(convoId, msg)
      // Stamp the discriminant so the element matches the page's $Typed union.
      const typed = { $type: 'chat.bsky.convo.defs#messageView', ...msg } as const
      qc.setQueryData<MessagesData>(qk.messages(convoId), (prev) => {
        // No cache yet (e.g. an empty/just-opened convo): seed a head page so the
        // bubble still appears immediately.
        if (!prev || prev.pages.length === 0) {
          return {
            pages: [{ messages: [typed], cursor: undefined }],
            pageParams: [undefined],
          } as MessagesData
        }
        const [head, ...rest] = prev.pages
        // Avoid duplicating if the poll already pulled it in.
        if (head.messages.some((m) => (m as ChatBskyConvoDefs.MessageView).id === msg.id)) {
          return prev
        }
        const newHead: Page = { ...head, messages: [typed, ...head.messages] }
        return { ...prev, pages: [newHead, ...rest] }
      })
    },
    [qc, convoId],
  )
}

/**
 * updateRead clears the convo's unread count. Fire on mount of an open convo
 * and whenever the newest message id changes (new inbound while focused).
 * Invalidates the convo list so the unread dot disappears.
 */
export function useMarkRead(convoId: string | undefined, latestMessageId: string | undefined) {
  const { chatAgent, did, isAuthed } = useAgent()
  const qc = useQueryClient()

  useEffect(() => {
    if (!isAuthed || !chatAgent || !convoId) return
    let cancelled = false
    chatAgent.chat.bsky.convo
      .updateRead({ convoId, messageId: latestMessageId })
      .then(() => {
        if (cancelled) return
        // Refresh unread counts in the list (prefix match across status filters).
        qc.invalidateQueries({ queryKey: qk.convos(did) })
      })
      .catch(() => {
        /* read receipts are best-effort; a failure must not break the thread */
      })
    return () => {
      cancelled = true
    }
  }, [chatAgent, isAuthed, convoId, latestMessageId, did, qc])
}
