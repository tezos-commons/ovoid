import { memo, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { ChatBskyConvoDefs } from '@atproto/api'
import type { ChatBskyGroupDefs } from '@atproto/api'
import { Avatar, ProfileHoverCard } from '@/components'
import { RichText, textWithoutLinkUris } from '@/lib/rich-text'
import { absoluteTime, clockTime } from '@/lib/time'
import { haptic } from '@/lib/haptics'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useLongPress } from '@/lib/use-long-press'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { profileOptions } from '@/features/profile/use-profile'
import { authorFeedOptions } from '@/features/profile/use-author-feed'
import { MessageEmbeds, messagePreviewedLinkUris } from './MessageEmbeds'
import { MessageReactions } from './MessageReactions'
import { ReactionPicker } from './ReactionPicker'
import { MessageMenu } from './MessageMenu'
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
  /** Start a reply to this message. Present only in group chats — its presence
   *  switches long-press / right-click from the reaction picker to the Reply/Copy
   *  context menu. */
  onReply?: (message: ChatBskyConvoDefs.MessageView) => void
  /** Jump the thread scroll to a message by id (used by the replied-to quote). */
  onJumpToMessage?: (id: string) => void
  /** Resolve a sender DID to a display name (for the replied-to quote preview). */
  nameFor?: (did: string) => string
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
  onReply,
  onJumpToMessage,
  nameFor,
}: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  const senderDid = 'sender' in message ? message.sender?.did : undefined
  const mine = senderDid === viewerDid
  // A group message from someone else gets the avatar gutter + name treatment.
  const attributed = isGroup && !mine
  // In groups (onReply set) the long-press opens the Reply/Copy menu; in 1:1s it
  // opens the reaction picker. Both share the same press/right-click trigger.
  const interactive = !!(onReply || onReact)
  const longPress = useLongPress(() => {
    if (onReply) setMenuOpen(true)
    else if (onReact) setPickerOpen(true)
  })

  // Warm the sender's profile (+ its default Posts tab) when their avatar OR
  // name link dwells in view — the name shows on a run's first message, the
  // avatar on its last, so on a long run the name is tappable well before the
  // avatar mounts. schedulePrefetch dedupes by key, so repeated senders warm once.
  const { agent, did } = useAgent()
  const warmSender = () => {
    if (!senderDid) return
    const opts = profileOptions(agent, senderDid)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
    const posts = authorFeedOptions(agent, did, senderDid, 'posts_no_replies')
    schedulePrefetch(posts.queryKey, () => queryClient.prefetchInfiniteQuery(posts))
  }
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(warmSender)
  const namePrefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(warmSender)

  // The attributed avatar links to the sender's profile (group chats). Computed
  // once and reused by the deleted + normal branches.
  const avatarNode = showAvatar ? (
    senderDid ? (
      <ProfileHoverCard actor={senderDid}>
        <Link
          ref={prefetchRef}
          to={`/profile/${senderDid}`}
          className="msg-row__avatar-link"
          aria-label={senderName ? `View ${senderName}'s profile` : 'View profile'}
        >
          <Avatar src={senderAvatar} alt={senderName} fallback={senderName} size="sm" />
        </Link>
      </ProfileHoverCard>
    ) : (
      <Avatar src={senderAvatar} alt={senderName} fallback={senderName} size="sm" />
    )
  ) : null

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
        {attributed && <span className="msg-row__avatar">{avatarNode}</span>}
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

  // The message this one replies to (group replies), hydrated by the server as
  // the referenced message or a tombstone. Rendered as a small quote atop the
  // bubble so the reply has visible context — tappable to jump to the original.
  const replyTo = message.replyTo
  const replyPreview = ChatBskyConvoDefs.isDeletedMessageView(replyTo)
    ? { deleted: true as const, id: replyTo.id }
    : ChatBskyConvoDefs.isMessageView(replyTo)
      ? {
          deleted: false as const,
          id: replyTo.id,
          name: replyTo.sender?.did && nameFor ? nameFor(replyTo.sender.did) : '',
          text: replyTo.text,
        }
      : null

  const showBubble =
    remaining.length > 0 || message.embed?.$type === JOIN_LINK_EMBED || !!replyPreview

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
      {showName && attributed && senderName && (
        senderDid ? (
          <ProfileHoverCard actor={senderDid}>
            <Link to={`/profile/${senderDid}`} className="msg-row__name" ref={namePrefetchRef}>
              {senderName}
            </Link>
          </ProfileHoverCard>
        ) : (
          <span className="msg-row__name">{senderName}</span>
        )
      )}
      <div className="msg-row__inner">
        {attributed && <span className="msg-row__avatar">{avatarNode}</span>}
        <div
          className="msg-bubble-wrap"
          // With no bubble, the wrap (i.e. the embed cards) is the long-press
          // target so reactions / the menu stay reachable on touch.
          {...(!showBubble && interactive ? longPress.handlers : {})}
        >
          {showBubble && (
            <div
              className={clsx('msg-bubble', mine ? 'msg-bubble--mine' : 'msg-bubble--theirs')}
              {...(interactive ? longPress.handlers : {})}
            >
              {replyPreview && (
                <button
                  type="button"
                  className="msg-reply-quote"
                  aria-label="Jump to message"
                  // Stop propagation so a touch on the quote doesn't arm the
                  // bubble's long-press (Reply/Copy menu) — a tap should jump.
                  onClick={() => replyPreview.id && onJumpToMessage?.(replyPreview.id)}
                  onTouchStart={(e) => e.stopPropagation()}
                  onContextMenu={(e) => e.stopPropagation()}
                >
                  {replyPreview.deleted ? (
                    <span className="msg-reply-quote__text msg-reply-quote__text--muted">
                      Deleted message
                    </span>
                  ) : (
                    <>
                      {replyPreview.name && (
                        <span className="msg-reply-quote__name">{replyPreview.name}</span>
                      )}
                      <span className="msg-reply-quote__text">{replyPreview.text}</span>
                    </>
                  )}
                </button>
              )}
              {displayText && (
                <RichText
                  text={displayText}
                  facets={displayFacets}
                  omitLinkUris={omitUris}
                  className="msg-bubble__text"
                  mentionChips
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
          {menuOpen && (
            <MessageMenu
              align={mine ? 'end' : 'start'}
              mobile={isMobile}
              onReply={() => {
                onReply?.(message)
                setMenuOpen(false)
              }}
              onCopy={() => {
                void navigator.clipboard?.writeText(message.text)
                haptic('success')
                setMenuOpen(false)
              }}
              onClose={() => setMenuOpen(false)}
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
