import { useMemo } from 'react'
import { useInfiniteQuery, infiniteQueryOptions } from '@tanstack/react-query'
import type { Agent, ChatBskyConvoDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

export interface UseConvosResult {
  convos: ChatBskyConvoDefs.ConvoView[]
}

/** Shared infinite-query config for the convo list (hook + nav prefetch). */
export function convosOptions(
  chatAgent: Agent,
  did: string | undefined,
  status?: 'request' | 'accepted',
) {
  return infiniteQueryOptions({
    queryKey: [...qk.convos(did), { status }],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      chatAgent.chat.bsky.convo
        .listConvos({ cursor: pageParam, limit: 40, status })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    // staleTime matches the poll: the interval already bounds staleness, so a
    // shorter value only bought redundant refetches on remount between ticks.
    refetchInterval: 15_000,
    staleTime: 15_000,
  })
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
    ...convosOptions(chatAgent as Agent, did, opts?.status),
    enabled: isAuthed && !!chatAgent,
  })

  // Memoized on the cache entry so the 15s poll (usually identical data, same
  // reference via structural sharing) doesn't hand the list a fresh array and
  // defeat ConvoRow's memo.
  const convos = useMemo(() => query.data?.pages.flatMap((p) => p.convos) ?? [], [query.data])

  return { ...query, convos }
}
