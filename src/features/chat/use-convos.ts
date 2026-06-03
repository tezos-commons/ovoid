import { useInfiniteQuery } from '@tanstack/react-query'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

export interface UseConvosResult {
  convos: ChatBskyConvoDefs.ConvoView[]
}

/**
 * Conversation list via chat.bsky.convo.listConvos through the chat-proxied
 * agent. Polled on an interval (no DM websocket in the public API) so unread
 * counts and last-message previews stay fresh while the pane is open.
 *
 * Returns the bundle null-check to the caller: when signed out chatAgent is
 * null and the query is disabled.
 */
export function useConvos(opts?: { status?: 'request' | 'accepted' }) {
  const { chatAgent, did, isAuthed } = useAgent()

  const query = useInfiniteQuery({
    queryKey: [...qk.convos(did), { status: opts?.status }] as const,
    enabled: isAuthed && !!chatAgent,
    queryFn: ({ pageParam }) =>
      chatAgent!.chat.bsky.convo
        .listConvos({
          cursor: pageParam,
          limit: 40,
          status: opts?.status,
        })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    // Convo list freshness drives the unread dots; poll while mounted.
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const convos = query.data?.pages.flatMap((p) => p.convos) ?? []

  return { ...query, convos }
}
