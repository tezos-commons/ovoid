import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { AppBskyFeedDefs } from '@atproto/api'
import { Avatar, PostCard } from '@/components'
import {
  HeartIcon,
  RepostIcon,
  PersonIcon,
  ReplyIcon,
} from '@/components/Icon'
import { relativeTime } from '@/lib/time'
import type { ClusterGroup, PostGroup } from './grouping'
import type { Notification } from './use-notifications'

/* ============================================================
   Cluster row: stacked avatars + action icon + subject preview.
   ============================================================ */

const MAX_AVATARS = 8

/** Action icon + tint color per clustered reason. */
function clusterIcon(reason: string) {
  switch (reason) {
    case 'like':
    case 'like-via-repost':
      return { node: <HeartIcon size={26} filled />, color: 'var(--color-like)' }
    case 'repost':
    case 'repost-via-repost':
      return { node: <RepostIcon size={26} />, color: 'var(--color-repost)' }
    case 'follow':
    case 'starterpack-joined':
      return { node: <PersonIcon size={26} filled />, color: 'var(--color-primary)' }
    default:
      return { node: <PersonIcon size={26} />, color: 'var(--text-muted)' }
  }
}

function actorName(a: Notification['author']): string {
  return a.displayName?.trim() || `@${a.handle}`
}

/** "Alice", "Alice and Bob", "Alice, Bob and 5 others". */
function summarize(authors: Notification['author'][]): string {
  const n = authors.length
  if (n === 1) return actorName(authors[0])
  if (n === 2) return `${actorName(authors[0])} and ${actorName(authors[1])}`
  return `${actorName(authors[0])}, ${actorName(authors[1])} and ${n - 2} ${
    n - 2 === 1 ? 'other' : 'others'
  }`
}

function clusterVerb(reason: string): string {
  switch (reason) {
    case 'like':
    case 'like-via-repost':
      return 'liked your post'
    case 'repost':
    case 'repost-via-repost':
      return 'reposted your post'
    case 'follow':
      return 'followed you'
    case 'starterpack-joined':
      return 'joined via your starter pack'
    default:
      return 'interacted with you'
  }
}

function subjectPermalink(post: AppBskyFeedDefs.PostView): string {
  const rkey = post.uri.split('/').pop() ?? ''
  const actor = post.author.handle || post.author.did
  return `/profile/${actor}/post/${rkey}`
}

function subjectText(post: AppBskyFeedDefs.PostView): string {
  const rec = post.record as { text?: string } | undefined
  return rec?.text?.trim() || ''
}

export function ClusterRow({
  group,
  subject,
}: {
  group: ClusterGroup
  subject?: AppBskyFeedDefs.PostView
}) {
  const { node, color } = clusterIcon(group.reason)
  const shown = group.authors.slice(0, MAX_AVATARS)
  const overflow = group.authors.length - shown.length

  return (
    <article
      className={clsx('notif', !group.isRead && 'notif--unread')}
      aria-label={`${summarize(group.authors)} ${clusterVerb(group.reason)}`}
    >
      <div className="notif__icon" style={{ color }}>
        {node}
      </div>

      <div className="notif__main">
        <div className="notif__avatars">
          {shown.map((a) => (
            <Link
              key={a.did}
              to={`/profile/${a.handle || a.did}`}
              className="notif__avatar"
              title={actorName(a)}
            >
              <Avatar
                src={a.avatar}
                alt={actorName(a)}
                size="sm"
                fallback={a.displayName || a.handle}
              />
            </Link>
          ))}
          {overflow > 0 && <span className="notif__avatars-more">+{overflow}</span>}
        </div>

        <div className="notif__text">
          <span className="notif__names">{summarize(group.authors)}</span>{' '}
          <span className="notif__verb">{clusterVerb(group.reason)}</span>
          <span className="notif__dot">·</span>
          <time className="notif__time" dateTime={group.latestAt}>
            {relativeTime(group.latestAt)}
          </time>
        </div>

        {subject && subjectText(subject) && (
          <Link to={subjectPermalink(subject)} className="notif__subject">
            {subjectText(subject)}
          </Link>
        )}
      </div>
    </article>
  )
}

/* ============================================================
   Post row: reply / mention / quote rendered as a full PostCard.
   ============================================================ */

/**
 * Synthesize a PostView from a notification. The notification carries the raw
 * post record + author + uri + cid + indexedAt, which is everything PostCard
 * needs to render the body and header. Engagement counts and the viewer's
 * like/repost state are not present in the notification payload, so the action
 * row renders at zero — acceptable for a notification preview; tapping through
 * to the thread shows live counts.
 */
function notifToPostView(n: Notification): AppBskyFeedDefs.PostView {
  return {
    $type: 'app.bsky.feed.defs#postView',
    uri: n.uri,
    cid: n.cid,
    author: n.author,
    record: n.record,
    indexedAt: n.indexedAt,
    labels: n.labels,
  } as AppBskyFeedDefs.PostView
}

const POST_VERB: Record<string, string> = {
  reply: 'replied to you',
  mention: 'mentioned you',
  quote: 'quoted your post',
}

export function PostRow({ group }: { group: PostGroup }) {
  const post = notifToPostView(group.notif)
  return (
    <div className={clsx('notif-post', !group.isRead && 'notif--unread')}>
      <div className="notif-post__label">
        <ReplyIcon size={14} />
        <span>{POST_VERB[group.reason] ?? 'posted'}</span>
      </div>
      <PostCard post={post} hideActions />
    </div>
  )
}
