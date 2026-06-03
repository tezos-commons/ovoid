import { useCallback, useEffect } from 'react'
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type { ChatBskyConvoDefs, ChatBskyConvoGetMessages } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

export type MessageItem =
  | ChatBskyConvoDefs.MessageView
  | ChatBskyConvoDefs.DeletedMessageView
  | ChatBskyConvoDefs.SystemMessageView

type Page = ChatBskyConvoGetMessages.OutputSchema
export type MessagesData = InfiniteData<Page, string | undefined>

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

  const query = useInfiniteQuery({
    queryKey: convoId ? qk.messages(convoId) : ['bsky', 'chat', 'messages', { convoId: '' }],
    enabled,
    queryFn: ({ pageParam }) =>
      chatAgent!.chat.bsky.convo
        .getMessages({ convoId: convoId!, cursor: pageParam, limit: 50 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    refetchInterval: 6_000,
    staleTime: 2_000,
  })

  // Flattened oldest-first for natural top-to-bottom rendering. Each page is
  // newest-first; later pages are older — so reverse pages and items.
  const messages: MessageItem[] =
    query.data?.pages
      .flatMap((p) => p.messages as MessageItem[])
      .slice()
      .reverse() ?? []

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
      qc.setQueryData<MessagesData>(qk.messages(convoId), (prev) => {
        if (!prev || prev.pages.length === 0) return prev
        const [head, ...rest] = prev.pages
        // Avoid duplicating if the poll already pulled it in.
        if (head.messages.some((m) => (m as ChatBskyConvoDefs.MessageView).id === msg.id)) {
          return prev
        }
        // Stamp the discriminant so the element matches the page's $Typed union.
        const typed = { $type: 'chat.bsky.convo.defs#messageView', ...msg } as const
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
