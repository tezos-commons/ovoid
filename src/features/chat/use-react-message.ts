import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import type { MessagesData } from './use-messages'

type MessageView = ChatBskyConvoDefs.MessageView

export interface ToggleReactionArgs {
  messageId: string
  /** The emoji to toggle. */
  value: string
  /** true → add the reaction, false → remove it. */
  add: boolean
}

/** Replace a message (matched by id) in the messages cache, immutably. */
function patchMessage(
  qc: QueryClient,
  convoId: string,
  messageId: string,
  update: (m: MessageView) => MessageView,
): void {
  qc.setQueryData<MessagesData>(qk.messages(convoId), (prev) => {
    if (!prev) return prev
    let changed = false
    const pages = prev.pages.map((page) => {
      let pageChanged = false
      const messages = page.messages.map((m) => {
        const mv = m as MessageView
        if (mv.id === messageId && m.$type === 'chat.bsky.convo.defs#messageView') {
          pageChanged = true
          // Re-stamp the discriminant so the result stays in the page's $Typed union.
          return { ...update(mv), $type: 'chat.bsky.convo.defs#messageView' as const }
        }
        return m
      })
      if (!pageChanged) return page
      changed = true
      return { ...page, messages }
    })
    return changed ? { ...prev, pages } : prev
  })
}

/**
 * Add / remove an emoji reaction on a message (chat.bsky.convo.addReaction /
 * removeReaction). Optimistically patches the message's `reactions` for instant
 * feedback, rolls back on error, and reconciles with the authoritative message
 * the endpoint returns. Used by every bubble through one hook in MessageThread.
 */
export function useToggleReaction(convoId: string) {
  const { chatAgent, did } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ messageId, value, add }: ToggleReactionArgs): Promise<MessageView> => {
      if (!chatAgent) throw new Error('Not signed in to chat')
      const res = add
        ? await chatAgent.chat.bsky.convo.addReaction({ convoId, messageId, value })
        : await chatAgent.chat.bsky.convo.removeReaction({ convoId, messageId, value })
      return res.data.message
    },
    onMutate: async ({ messageId, value, add }) => {
      const prev = qc.getQueryData<MessagesData>(qk.messages(convoId))
      patchMessage(qc, convoId, messageId, (m) => {
        const reactions = m.reactions ?? []
        const mine = (r: ChatBskyConvoDefs.ReactionView) => r.value === value && r.sender.did === did
        if (add) {
          if (reactions.some(mine)) return m
          const optimistic: ChatBskyConvoDefs.ReactionView = {
            $type: 'chat.bsky.convo.defs#reactionView',
            value,
            sender: { did: did ?? '' },
            createdAt: new Date().toISOString(),
          }
          return { ...m, reactions: [...reactions, optimistic] }
        }
        return { ...m, reactions: reactions.filter((r) => !mine(r)) }
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.messages(convoId), ctx.prev)
    },
    onSuccess: (message) => {
      // Reconcile with the server's authoritative reactions for that message.
      patchMessage(qc, convoId, message.id, () => message)
    },
  })
}
