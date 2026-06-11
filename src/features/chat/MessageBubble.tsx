import { memo } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import type { ChatBskyConvoDefs, ChatBskyGroupDefs } from '@atproto/api'
import { Avatar } from '@/components'
import { RichText } from '@/lib/rich-text'
import { absoluteTime, clockTime } from '@/lib/time'
import type { MessageItem } from './use-messages'

const JOIN_LINK_EMBED = 'chat.bsky.embed.joinLink#view'
const JOIN_LINK_PREVIEW = 'chat.bsky.group.defs#joinLinkPreviewView'

/** A group-invite embed renders as a tappable card linking to the join landing. */
function JoinLinkEmbed({ embed }: { embed: NonNullable<ChatBskyConvoDefs.MessageView['embed']> }) {
  if (embed.$type !== JOIN_LINK_EMBED) return null
  const preview = (embed as { joinLinkPreview?: { $type?: string } }).joinLinkPreview
  if (!preview || preview.$type !== JOIN_LINK_PREVIEW) {
    return <div className="msg-joinlink">Group invite unavailable</div>
  }
  const p = preview as unknown as ChatBskyGroupDefs.JoinLinkPreviewView
  return (
    <Link to={`/group/join/${p.code}`} className="msg-joinlink">
      <Avatar src={p.owner.avatar} alt={p.name} fallback={p.name} size="xs" shape="rounded-square" />
      <span>
        <span className="msg-joinlink__name">{p.name}</span> · {p.memberCount} members
      </span>
    </Link>
  )
}

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
  /** Group convo: attribute non-self messages with sender avatar + name. */
  isGroup?: boolean
  /** Render the sender avatar in the gutter (last bubble of a cluster). */
  showAvatar?: boolean
  /** Render the sender name above the bubble (first bubble of a cluster). */
  showName?: boolean
  senderName?: string
  senderAvatar?: string
}

/**
 * memo: the thread re-renders on every 6s poll; message views are referentially
 * stable via structural sharing, so unchanged bubbles skip entirely.
 *
 * System messages are NOT rendered here — the thread routes them to
 * <SystemMessage> so runs can collapse. This component handles message/deleted.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  viewerDid,
  showTime = true,
  isGroup = false,
  showAvatar = false,
  showName = false,
  senderName,
  senderAvatar,
}: MessageBubbleProps) {
  const senderDid = 'sender' in message ? message.sender?.did : undefined
  const mine = senderDid === viewerDid
  // A group message from someone else gets the avatar gutter + name treatment.
  const attributed = isGroup && !mine

  if (isDeleted(message)) {
    return (
      <div className={clsx('msg-row', mine ? 'msg-row--mine' : 'msg-row--theirs', attributed && 'msg-row--group')}>
        {attributed && <span className="msg-row__avatar">{showAvatar && <Avatar src={senderAvatar} alt={senderName} fallback={senderName} size="xs" />}</span>}
        <div className="msg-bubble msg-bubble--deleted">Message deleted</div>
      </div>
    )
  }

  if (!isMessageView(message)) return null

  const bubble = (
    <div
      className={clsx('msg-row', mine ? 'msg-row--mine' : 'msg-row--theirs', attributed && 'msg-row--group')}
      title={absoluteTime(message.sentAt, { year: 'numeric' })}
    >
      {showName && attributed && senderName && <span className="msg-row__name">{senderName}</span>}
      <div className="msg-row__inner">
        {attributed && (
          <span className="msg-row__avatar">
            {showAvatar && <Avatar src={senderAvatar} alt={senderName} fallback={senderName} size="xs" />}
          </span>
        )}
        <div className={clsx('msg-bubble', mine ? 'msg-bubble--mine' : 'msg-bubble--theirs')}>
          {message.text && (
            <RichText text={message.text} facets={message.facets} className="msg-bubble__text" />
          )}
          {message.embed && <JoinLinkEmbed embed={message.embed} />}
        </div>
      </div>
      {showTime && <span className="msg-row__time">{clockTime(message.sentAt)}</span>}
    </div>
  )
  return bubble
})

export { isMessageView, isDeleted }
