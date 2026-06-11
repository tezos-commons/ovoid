import { useMemo } from 'react'
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { Agent, ChatBskyGroupDefs, ChatBskyGroupListJoinRequests } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { applyConvo } from './chat-cache'

type Page = ChatBskyGroupListJoinRequests.OutputSchema

/**
 * Pending join requests for a group (chat.bsky.group.listJoinRequests). Owner-only
 * read — gate `enabled` on viewerOwnsGroup. The approve/reject mutations below
 * mutate this list and the roster.
 */
export function joinRequestsOptions(
  chatAgent: Agent,
  did: string | undefined,
  convoId: string,
) {
  return infiniteQueryOptions({
    queryKey: qk.joinRequests(did, convoId),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      chatAgent.chat.bsky.group
        .listJoinRequests({ convoId, cursor: pageParam, limit: 30 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page) => last.cursor || undefined,
    staleTime: 30_000,
  })
}

export function useJoinRequests(convoId: string | undefined, enabled = true) {
  const { chatAgent, did, isAuthed } = useAgent()
  const on = enabled && isAuthed && !!chatAgent && !!convoId

  const query = useInfiniteQuery({
    ...joinRequestsOptions(chatAgent!, did, convoId ?? ''),
    enabled: on,
  })

  const requests: ChatBskyGroupDefs.JoinRequestView[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.requests) ?? [],
    [query.data],
  )

  return { ...query, requests }
}

/**
 * Approve / reject a pending join request (owner-only). Approve returns the
 * updated convo (new member); reject returns nothing. Both refetch the request
 * list; approve also refreshes the roster.
 */
export function useResolveJoinRequest(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ member, action }: { member: string; action: 'approve' | 'reject' }) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      if (action === 'approve') {
        const res = await chatAgent.chat.bsky.group.approveJoinRequest({ convoId, member })
        return res.data.convo
      }
      await chatAgent.chat.bsky.group.rejectJoinRequest({ convoId, member })
      return undefined
    },
    onSuccess: (convo) => {
      if (convo) {
        applyConvo(qc, did, convo)
        qc.invalidateQueries({ queryKey: qk.convoMembers(did, convoId) })
      }
      qc.invalidateQueries({ queryKey: qk.joinRequests(did, convoId) })
    },
  })
}

/** Mark the join-request list read (clears the owner's unread badge). */
export function useMarkJoinRequestsRead(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      await chatAgent.chat.bsky.group.updateJoinRequestsRead({ convoId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.convo(did, convoId) })
    },
  })
}

/**
 * Request to join a group via invite code (chat.bsky.group.requestJoin). Returns
 * { status: 'joined' | 'pending', convo? }. On a direct join the convo list
 * gains a row; either way the link preview's viewer state changes.
 */
export function useRequestJoin() {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.requestJoin({ code })
      return { code, ...res.data }
    },
    onSuccess: ({ code }) => {
      qc.invalidateQueries({ queryKey: qk.joinLinkPreview(code) })
      qc.invalidateQueries({ queryKey: qk.convos(did) })
    },
  })
}

/** Withdraw a pending join request (chat.bsky.group.withdrawJoinRequest). */
export function useWithdrawJoinRequest(code: string | undefined) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (convoId: string) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      await chatAgent.chat.bsky.group.withdrawJoinRequest({ convoId })
    },
    onSuccess: () => {
      if (code) qc.invalidateQueries({ queryKey: qk.joinLinkPreview(code) })
      qc.invalidateQueries({ queryKey: qk.convos(did) })
    },
  })
}
