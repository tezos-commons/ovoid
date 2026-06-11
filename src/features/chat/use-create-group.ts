import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

export interface CreateGroupInput {
  name: string
  /** Member DIDs to seed the group with (the creator is added server-side). */
  members: string[]
}

/**
 * Create a group chat (chat.bsky.group.createGroup) and return the new convo.
 *
 * Invariant: the server creates the record and makes the caller the owner, so we
 * don't optimistically synthesize a convo — we seed the freshly-returned view
 * into both the single-convo cache (so the thread header/settings render without
 * a refetch) and invalidate the list so the row appears.
 */
export function useCreateGroup() {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, members }: CreateGroupInput): Promise<ChatBskyConvoDefs.ConvoView> => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = await chatAgent.chat.bsky.group.createGroup({ name, members })
      return res.data.convo
    },
    onSuccess: (convo) => {
      qc.setQueryData(qk.convo(did, convo.id), convo)
      qc.invalidateQueries({ queryKey: qk.convos(did) })
    },
  })
}
