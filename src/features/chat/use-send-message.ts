import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { buildPost } from '@/lib/rich-text'
import { qk } from '@/lib/query-keys'
import { usePrependSentMessage } from './use-messages'

/**
 * sendMessage via the chat-proxied agent. The created MessageView is prepended
 * into the head page immediately (so the bubble appears without waiting for the
 * 6s poll) and the convo list is invalidated to bump last-message preview/order.
 *
 * The text goes through the same buildPost pipeline as the composer: self-origin
 * links become portable bsky.app links, then facets (links/mentions/tags) are
 * detected — the chat service does NOT detect facets server-side, so without
 * this, links in our messages would be dead text in every client.
 *
 * We do NOT do a fully optimistic temp-bubble: sendMessage is fast and returns
 * the authoritative MessageView (with server id/rev/sentAt), and a failed send
 * surfaces as a thrown error the composer renders inline. Showing a phantom
 * bubble that then has to be reconciled by id would be more code for no gain
 * given the round-trip latency here.
 */
export function useSendMessage(convoId: string) {
  const { agent, chatAgent, did } = useAgent()
  const qc = useQueryClient()
  const prepend = usePrependSentMessage(convoId)

  return useMutation({
    mutationFn: async (text: string): Promise<ChatBskyConvoDefs.MessageView> => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const trimmed = text.trim()
      if (!trimmed) throw new Error('Message is empty')
      const { text: finalText, facets } = await buildPost(agent, trimmed)
      const res = await chatAgent.chat.bsky.convo.sendMessage({
        convoId,
        message: { text: finalText, facets },
      })
      return res.data
    },
    onSuccess: (msg) => {
      prepend(msg)
      qc.invalidateQueries({ queryKey: qk.convos(did) })
    },
  })
}
