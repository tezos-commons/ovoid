import clsx from 'clsx'
import type { AppBskyFeedDefs } from '@atproto/api'
import { HeartIcon, RepostIcon, ReplyIcon, ShareIcon } from './Icon'

export interface ActionRowProps {
  post: AppBskyFeedDefs.PostView
  onReply?: () => void
  onRepost?: () => void
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
export function ActionRow({ post, onReply, onRepost, onLike, onShare }: ActionRowProps) {
  const liked = !!post.viewer?.like
  const reposted = !!post.viewer?.repost

  const stop = (fn?: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fn?.()
  }

  return (
    <div className="actionrow">
      <button className="action action--reply" onClick={stop(onReply)} aria-label="Reply">
        <ReplyIcon size={16} />
        {fmt(post.replyCount)}
      </button>
      <button
        className={clsx('action action--repost', reposted && 'action--active')}
        onClick={stop(onRepost)}
        aria-label="Repost"
        aria-pressed={reposted}
      >
        <RepostIcon size={16} />
        {fmt(post.repostCount)}
      </button>
      <button
        className={clsx('action action--like', liked && 'action--active')}
        onClick={stop(onLike)}
        aria-label="Like"
        aria-pressed={liked}
      >
        <HeartIcon size={16} filled={liked} />
        {fmt(post.likeCount)}
      </button>
      <button className="action action--share" onClick={stop(onShare)} aria-label="Share">
        <ShareIcon size={16} />
      </button>
    </div>
  )
}
