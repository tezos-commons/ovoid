import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Agent, ChatBskyConvoDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Single convo view via chat.bsky.convo.getConvo. Backs the group thread header
 * and the settings screen, which need group metadata (name, lockStatus,
 * joinLink, join-request counts) that the list's partial entries may not carry
 * after navigation. Seeded from the convo list where possible (see ConvoList).
 */
export function convoOptions(chatAgent: Agent, did: string | undefined, convoId: string) {
  return queryOptions({
    queryKey: qk.convo(did, convoId),
    queryFn: () =>
      chatAgent.chat.bsky.convo.getConvo({ convoId }).then((r) => r.data.convo),
    staleTime: 15_000,
  })
}

export function useConvo(convoId: string | undefined) {
  const { chatAgent, did, isAuthed } = useAgent()
  const enabled = isAuthed && !!chatAgent && !!convoId
  return useQuery({
    ...convoOptions(chatAgent!, did, convoId ?? ''),
    enabled,
  })
}

export type ConvoView = ChatBskyConvoDefs.ConvoView
