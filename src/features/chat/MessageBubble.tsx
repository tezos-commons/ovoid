import { memo } from 'react'
import clsx from 'clsx'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { RichText } from '@/lib/rich-text'
import { absoluteTime, clockTime } from '@/lib/time'
import type { MessageItem } from './use-messages'

function isMessageView(m: MessageItem): m is ChatBskyConvoDefs.MessageView {
  return m.$type === 'chat.bsky.convo.defs#messageView' || 'text' in m
}
function isDeleted(m: MessageItem): m is ChatBskyConvoDefs.DeletedMessageView {
  return m.$type === 'chat.bsky.convo.defs#deletedMessageView'
}

export interface MessageBubbleProps {
  message: MessageItem
  /** viewer DID — own messages align right (blue), others left (gray). */
  viewerDid: string | undefined
  /** Hide the timestamp when the next bubble is from the same author < 5m later. */
  showTime?: boolean
}

/**
 * memo: the thread re-renders on every 6s poll; message views are referentially
 * stable via structural sharing, so unchanged bubbles skip entirely.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  viewerDid,
  showTime = true,
}: MessageBubbleProps) {
  // SystemMessageView carries no sender; only message/deleted views do.
  const senderDid = 'sender' in message ? message.sender?.did : undefined
  const mine = senderDid === viewerDid

  if (isDeleted(message)) {
    return (
      <div className={clsx('msg-row', mine ? 'msg-row--mine' : 'msg-row--theirs')}>
        <div className="msg-bubble msg-bubble--deleted">Message deleted</div>
      </div>
    )
  }

  if (!isMessageView(message)) {
    // System message (member join/leave, group edits) — render centered.
    return (
      <div className="msg-system">
        <span>{(message as { text?: string }).text ?? 'Conversation updated'}</span>
      </div>
    )
  }

  return (
    <div
      className={clsx('msg-row', mine ? 'msg-row--mine' : 'msg-row--theirs')}
      title={absoluteTime(message.sentAt, { year: 'numeric' })}
    >
      <div className={clsx('msg-bubble', mine ? 'msg-bubble--mine' : 'msg-bubble--theirs')}>
        <RichText
          text={message.text}
          facets={message.facets}
          className="msg-bubble__text"
        />
      </div>
      {showTime && <span className="msg-row__time">{clockTime(message.sentAt)}</span>}
    </div>
  )
})
