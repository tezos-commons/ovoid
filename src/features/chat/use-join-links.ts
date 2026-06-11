import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ChatBskyConvoDefs, ChatBskyGroupDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { groupKind } from './group'

/**
 * Group invite-link management (chat.bsky.group.{create,edit,enable,disable}JoinLink).
 * Owner-only. Each returns the updated JoinLinkView (not a full convo), so we
 * patch it onto the group's `kind.joinLink` in the single-convo cache and
 * invalidate the list. `joinRule` is 'anyone' | 'followedByOwner'.
 */
function patchJoinLink(
  qc: QueryClient,
  did: string | undefined,
  convoId: string,
  joinLink: ChatBskyGroupDefs.JoinLinkView | undefined,
): void {
  qc.setQueryData<ChatBskyConvoDefs.ConvoView>(qk.convo(did, convoId), (prev) => {
    if (!prev) return prev
    const g = groupKind(prev)
    if (!g) return prev
    return {
      ...prev,
      kind: { ...g, $type: 'chat.bsky.convo.defs#groupConvo', joinLink },
    }
  })
  qc.invalidateQueries({ queryKey: qk.convos(did) })
}

export interface JoinLinkRules {
  joinRule: ChatBskyGroupDefs.JoinRule
  requireApproval?: boolean
}

export function useCreateJoinLink(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ joinRule, requireApproval }: JoinLinkRules) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.createJoinLink({
        convoId,
        joinRule,
        requireApproval,
      })
      return res.data.joinLink
    },
    onSuccess: (joinLink) => patchJoinLink(qc, did, convoId, joinLink),
  })
}

export function useEditJoinLink(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ joinRule, requireApproval }: Partial<JoinLinkRules>) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.editJoinLink({
        convoId,
        joinRule,
        requireApproval,
      })
      return res.data.joinLink
    },
    onSuccess: (joinLink) => patchJoinLink(qc, did, convoId, joinLink),
  })
}

export function useEnableJoinLink(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.enableJoinLink({ convoId })
      return res.data.joinLink
    },
    onSuccess: (joinLink) => patchJoinLink(qc, did, convoId, joinLink),
  })
}

export function useDisableJoinLink(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.disableJoinLink({ convoId })
      return res.data.joinLink
    },
    onSuccess: (joinLink) => patchJoinLink(qc, did, convoId, joinLink),
  })
}
