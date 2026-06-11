import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Leave a conversation (chat.bsky.convo.leaveConvo). Works for groups and DMs.
 * Returns { convoId, rev }; the caller navigates back to the list. We drop the
 * single-convo cache and invalidate the list so the row disappears.
 */
export function useLeaveConvo(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.convo.leaveConvo({ convoId })
      return res.data
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: qk.convo(did, convoId) })
      qc.invalidateQueries({ queryKey: qk.convos(did) })
    },
  })
}
