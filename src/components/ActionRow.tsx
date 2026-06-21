import clsx from 'clsx'
import type { AppBskyFeedDefs, AppBskyFeedPost } from '@atproto/api'
import { HeartIcon, MoreIcon, QuoteIcon, RepostIcon, ReplyIcon, ShareIcon } from './Icon'
import { Menu } from './Menu'
import { haptic } from '@/lib/haptics'
import { useAgent } from '@/lib/api/agent'
import { notifyConfigured } from '@/lib/notify/client'
import {
  useNotifyMutes,
  useNotifyThreadMutes,
  usePutNotifyMute,
  usePutThreadMute,
} from '@/lib/notify/use-notify'

export interface ActionRowProps {
  post: AppBskyFeedDefs.PostView
  onReply?: () => void
  onRepost?: () => void
  onQuote?: () => void
  onLike?: () => void
  onShare?: () => void
}

function fmt(n: number | undefined): string {
  if (!n) return ''
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
  return `${(n / 1_000_000).toFixed(1)}M`
}

/**
 * Reply / repost / like / share row. Active states are driven by the post's
 * own viewer state (post.viewer.like / .repost) so optimistic patches to the
 * cached PostView flow straight through with no local state.
 */
export function ActionRow({ post, onReply, onRepost, onQuote, onLike, onShare }: ActionRowProps) {
  const liked = !!post.viewer?.like
  const reposted = !!post.viewer?.repost
  const embeddingDisabled = !!post.viewer?.embeddingDisabled

  const stop = (fn?: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fn?.()
  }
  // Like gets a tactile tick; reply/share navigate or open chrome, so they
  // don't. (Repost's tick fires from inside the menu item.)
  const tap = (fn?: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    haptic('light')
    fn?.()
  }

  // Repost + Quote share one menu, matching the Bluesky repost dropdown. Quote
  // is omitted when the author has disabled embedding of this post (postgate).
  const repostItems = [
    {
      key: 'repost',
      label: reposted ? 'Undo repost' : 'Repost',
      icon: <RepostIcon size={18} />,
      active: reposted,
      onSelect: () => {
        haptic('light')
        onRepost?.()
      },
    },
    ...(onQuote && !embeddingDisabled
      ? [
          {
            key: 'quote',
            label: 'Quote post',
            icon: <QuoteIcon size={18} />,
            onSelect: () => onQuote(),
          },
        ]
      : []),
  ]

  return (
    <div className="actionrow">
      <button className="action action--reply" onClick={stop(onReply)} aria-label="Reply">
        <ReplyIcon size={16} />
        {fmt(post.replyCount)}
      </button>
      {/* The whole card navigates on click — keep menu interaction inside it. */}
      <span
        className="action--more"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <Menu
          trigger={
            <button
              className={clsx('action action--repost', reposted && 'action--active')}
              aria-label="Repost"
              aria-pressed={reposted}
              type="button"
            >
              <RepostIcon size={16} />
              {fmt(post.repostCount)}
            </button>
          }
          items={repostItems}
          align="start"
        />
      </span>
      <button
        className={clsx('action action--like', liked && 'action--active')}
        onClick={tap(onLike)}
        aria-label="Like"
        aria-pressed={liked}
      >
        <HeartIcon size={16} filled={liked} />
        {fmt(post.likeCount)}
      </button>
      <button className="action action--share" onClick={stop(onShare)} aria-label="Share">
        <ShareIcon size={16} />
      </button>
      <PostNotifyMenu post={post} />
    </div>
  )
}

/**
 * Per-post overflow ("…", far right): notification controls backed by the
 * Ovoid notify service — mute/unmute this thread, mute/unmute the author.
 * Hidden when signed out or the deployment has no notify service. The queries
 * are app-wide lists shared across every card (one fetch, N observers).
 */
function PostNotifyMenu({ post }: { post: AppBskyFeedDefs.PostView }) {
  const { did, isAuthed } = useAgent()
  const show = isAuthed && notifyConfigured()
  const { data: threadMutes } = useNotifyThreadMutes(show)
  const { data: accountMutes } = useNotifyMutes(show)
  const putThread = usePutThreadMute()
  const putAccount = usePutNotifyMute()
  if (!show) return null

  const record = post.record as AppBskyFeedPost.Record | undefined
  const root = record?.reply?.root?.uri ?? post.uri
  const threadMuted = !!threadMutes?.includes(root)
  const authorMuted = !!accountMutes?.includes(post.author.did)
  const isOwn = post.author.did === did

  const items = [
    {
      key: 'thread-mute',
      label: threadMuted ? 'Unmute thread notifications' : 'Mute thread notifications',
      onSelect: () => putThread.mutate({ root, muted: !threadMuted }),
    },
    ...(!isOwn
      ? [
          {
            key: 'account-mute',
            label: authorMuted
              ? `Unmute notifications from @${post.author.handle}`
              : `Mute notifications from @${post.author.handle}`,
            onSelect: () => putAccount.mutate({ subject: post.author.did, muted: !authorMuted }),
          },
        ]
      : []),
  ]

  return (
    // The whole card navigates on click — keep menu interaction inside it.
    <span
      className="action action--more"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <Menu
        trigger={
          <button className="action" aria-label="Notification options" type="button">
            <MoreIcon size={16} />
          </button>
        }
        items={items}
      />
    </span>
  )
}
