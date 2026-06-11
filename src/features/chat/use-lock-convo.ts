import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { applyConvo } from './chat-cache'

/**
 * Lock / unlock a group (chat.bsky.convo.lockConvo / unlockConvo). A locked group
 * accepts no new messages. Owner-only. `lockStatus === 'locked-permanently'` (a
 * moderation override) cannot be undone client-side — gate the unlock control on
 * that, since the server will reject it.
 *
 * Pass `lock: true` to lock, `false` to unlock. Both return the updated convo.
 */
export function useLockConvo(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (lock: boolean) => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = lock
        ? await chatAgent.chat.bsky.convo.lockConvo({ convoId })
        : await chatAgent.chat.bsky.convo.unlockConvo({ convoId })
      return res.data.convo
    },
    onSuccess: (convo) => applyConvo(qc, did, convo),
  })
}
