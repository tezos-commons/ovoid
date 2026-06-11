import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { applyConvo } from './chat-cache'

/**
 * Rename a group (chat.bsky.group.editGroup). Owner-only on the server; gate the
 * entry point on viewerOwnsGroup. Returns the updated convo, applied to caches.
 */
export function useEditGroup(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.editGroup({ convoId, name })
      return res.data.convo
    },
    onSuccess: (convo) => applyConvo(qc, did, convo),
  })
}
