import { memo, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import type { ChatBskyConvoDefs, ChatBskyGroupDefs } from '@atproto/api'
import { Avatar } from '@/components'
import { RichText, textWithoutLinkUris } from '@/lib/rich-text'
import { absoluteTime, clockTime } from '@/lib/time'
import { useLongPress } from '@/lib/use-long-press'
import { MessageEmbeds, messagePreviewedLinkUris } from './MessageEmbeds'
import { MessageReactions } from './MessageReactions'
import { ReactionPicker } from './ReactionPicker'
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
  /** Toggle a reaction on this message; absent when reactions are unavailable
   *  (signed out). add=true to add the viewer's reaction, false to remove. */
  onReact?: (messageId: string, value: string, add: boolean) => void
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
  onReact,
}: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const senderDid = 'sender' in message ? message.sender?.did : undefined
  const mine = senderDid === viewerDid
  // A group message from someone else gets the avatar gutter + name treatment.
  const attributed = isGroup && !mine
  const longPress = useLongPress(() => onReact && setPickerOpen(true))

  // Links that MessageEmbeds previews are stripped from the bubble text (the
  // card stands in for them). When nothing remains — a bare link message, or a
  // shared post with no comment — the bubble is dropped entirely so no empty
  // padded bar sits above the card.
  const omitUris = useMemo(
    () => (isMessageView(message) ? messagePreviewedLinkUris(message) : []),
    [message],
  )
  const remaining = useMemo(
    () =>
      isMessageView(message) ? textWithoutLinkUris(message.text, message.facets, omitUris) : '',
    [message, omitUris],
  )

  if (isDeleted(message)) {
    return (
      <div className={clsx('msg-row', mine ? 'msg-row--mine' : 'msg-row--theirs', attributed && 'msg-row--group')}>
        {attributed && <span className="msg-row__avatar">{showAvatar && <Avatar src={senderAvatar} alt={senderName} fallback={senderName} size="xs" />}</span>}
        <div className="msg-bubble msg-bubble--deleted">Message deleted</div>
      </div>
    )
  }

  if (!isMessageView(message)) return null

  // Facet-less text shows raw URLs as plain segments RichText can't omit, so
  // render the pre-stripped remainder instead; with facets, RichText drops the
  // omitted link segments itself (and trims the whitespace they leave).
  const hasFacets = !!message.facets?.length
  const displayText = hasFacets ? message.text : remaining
  const displayFacets = hasFacets ? message.facets : undefined
  const showBubble = remaining.length > 0 || message.embed?.$type === JOIN_LINK_EMBED

  const react = (value: string, add: boolean) => {
    onReact?.(message.id, value, add)
    setPickerOpen(false)
  }
  const pickFromPicker = (value: string) => {
    const already = (message.reactions ?? []).some(
      (r) => r.value === value && r.sender.did === viewerDid,
    )
    react(value, !already)
  }

  return (
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
        <div
          className="msg-bubble-wrap"
          // With no bubble, the wrap (i.e. the embed cards) is the long-press
          // target so reactions stay reachable on touch.
          {...(!showBubble && onReact ? longPress.handlers : {})}
        >
          {showBubble && (
            <div
              className={clsx('msg-bubble', mine ? 'msg-bubble--mine' : 'msg-bubble--theirs')}
              {...(onReact ? longPress.handlers : {})}
            >
              {displayText && (
                <RichText
                  text={displayText}
                  facets={displayFacets}
                  omitLinkUris={omitUris}
                  className="msg-bubble__text"
                />
              )}
              {message.embed && <JoinLinkEmbed embed={message.embed} />}
            </div>
          )}
          <MessageEmbeds message={message} />
          {pickerOpen && (
            <ReactionPicker
              align={mine ? 'end' : 'start'}
              onPick={pickFromPicker}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
        {onReact && (
          <button
            type="button"
            className="msg-react-btn"
            aria-label="Add reaction"
            onClick={() => setPickerOpen((v) => !v)}
          >
            <ReactIcon />
          </button>
        )}
      </div>
      <MessageReactions reactions={message.reactions} viewerDid={viewerDid} onToggle={react} />
      {showTime && <span className="msg-row__time">{clockTime(message.sentAt)}</span>}
    </div>
  )
})

function ReactIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.1" fill="currentColor" />
      <circle cx="15" cy="10" r="1.1" fill="currentColor" />
      <path d="M8.5 14.5a4 4 0 0 0 7 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export { isMessageView, isDeleted }
