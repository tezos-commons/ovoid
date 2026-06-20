import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { buildPost } from '@/lib/rich-text'
import { rewriteEmbeddableLinks } from '@/features/read/embeddable-url'
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
/** Send a message, optionally as a reply to another message (group chats). */
export interface SendMessageInput {
  text: string
  /** Message id this is a reply to; attaches a `replyTo` ref (group replies). */
  replyToId?: string
}

export function useSendMessage(convoId: string) {
  const { agent, chatAgent, did } = useAgent()
  const qc = useQueryClient()
  const prepend = usePrependSentMessage(convoId)

  return useMutation({
    mutationFn: async ({
      text,
      replyToId,
    }: SendMessageInput): Promise<ChatBskyConvoDefs.MessageView> => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const trimmed = text.trim()
      if (!trimmed) throw new Error('Message is empty')
      // Reader links -> the article's canonical embeddable URL (rich card on bsky).
      const embeddable = await rewriteEmbeddableLinks(trimmed)
      const { text: finalText, facets } = await buildPost(agent, embeddable)
      const res = await chatAgent.chat.bsky.convo.sendMessage({
        convoId,
        message: {
          text: finalText,
          facets,
          ...(replyToId ? { replyTo: { messageId: replyToId } } : {}),
        },
      })
      return res.data
    },
    onSuccess: (msg) => {
      prepend(msg)
      qc.invalidateQueries({ queryKey: qk.convos(did) })
    },
  })
}
