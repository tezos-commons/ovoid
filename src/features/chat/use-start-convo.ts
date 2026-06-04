import { useMutation } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'

/**
 * Resolve (or create) the 1:1 conversation with another account and return its
 * id. getConvoForMembers is idempotent — an existing convo is returned, so this
 * "continues" a chat rather than duplicating it; a brand-new convo opens empty
 * and is ready to compose into.
 *
 * The server enforces the recipient's incoming-DM policy, so a disallowed
 * recipient surfaces as a thrown error (isChatPermissionError). Callers should
 * gate the entry point on eligibility to keep that path rare.
 */
export function useStartConvo() {
  const { chatAgent } = useAgent()
  return useMutation({
    mutationFn: async (otherDid: string): Promise<string> => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.convo.getConvoForMembers({ members: [otherDid] })
      return res.data.convo.id
    },
  })
}
