import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { applyConvo } from './chat-cache'

/**
 * Add members to a group (chat.bsky.group.addMembers). Owner-only. Returns the
 * updated convo (new memberCount + refreshed important-members); also invalidates
 * the full roster so the settings member list refetches.
 */
export function useAddGroupMembers(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (members: string[]) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.addMembers({ convoId, members })
      return res.data.convo
    },
    onSuccess: (convo) => {
      applyConvo(qc, did, convo)
      qc.invalidateQueries({ queryKey: qk.convoMembers(did, convoId) })
    },
  })
}

/**
 * Remove members from a group (chat.bsky.group.removeMembers). Owner-only.
 */
export function useRemoveGroupMembers(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (members: string[]) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.removeMembers({ convoId, members })
      return res.data.convo
    },
    onSuccess: (convo) => {
      applyConvo(qc, did, convo)
      qc.invalidateQueries({ queryKey: qk.convoMembers(did, convoId) })
    },
  })
}
