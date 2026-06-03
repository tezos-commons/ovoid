import clsx from 'clsx'
import { useNavigate, Link } from 'react-router-dom'
import { AppBskyFeedPost, AppBskyFeedDefs } from '@atproto/api'
import { Avatar } from './Avatar'
import { ActionRow } from './ActionRow'
import { usePostActions } from './PostActionsContext'
import { PostEmbed } from './PostEmbed'
import {
  ProviderLinkPreviews,
  suppressImageEmbed,
  shouldDropExternalCard,
  previewedLinkUris,
} from './embeds/LinkPreviews'
import { LabelChips, hasBotLabel } from './LabelChips'
import { RichText } from '@/lib/rich-text'
import { relativeTime, absoluteTime } from '@/lib/time'
import { RepostIcon, BotIcon } from './Icon'

/** Robot badge shown before the name of an account labeled `bot`. */
function BotBadge({ labels }: { labels?: AppBskyFeedDefs.PostView['labels'] }) {
  if (!hasBotLabel(labels)) return null
  return (
    <span className="bot-badge" title="Automated account (bot)" aria-label="Bot">
      <BotIcon size={16} />
    </span>
  )
}

export interface PostCardProps {
  post: AppBskyFeedDefs.PostView
  reason?: AppBskyFeedDefs.ReasonRepost | AppBskyFeedDefs.ReasonPin
  reply?: AppBskyFeedDefs.ReplyRef
  variant?: 'feed' | 'focused'
  hideActions?: boolean
  isThreadChild?: boolean
  /** Render with a connector running down the avatar gutter to the post below
   *  (used for the thread root shown above a reply in the feed). */
  connectBelow?: boolean
}

/** Build the permalink for a post from its AT-URI + author handle. */
function postPermalink(post: AppBskyFeedDefs.PostView): string {
  const rkey = post.uri.split('/').pop() ?? ''
  const actor = post.author.handle || post.author.did
  return `/profile/${actor}/post/${rkey}`
}

function postRecord(post: AppBskyFeedDefs.PostView): AppBskyFeedPost.Record | null {
  const rec = post.record
  // isRecord narrows to a $TypedObject; cast to the public Record alias for use.
  return AppBskyFeedPost.isRecord(rec) ? (rec as AppBskyFeedPost.Record) : null
}

/**
 * The keystone post renderer. `feed` is the compact list row; `focused` is the
 * enlarged thread root (larger body, absolute timestamp, no row hover/click).
 * Network mutations are not wired here — feature hooks pass handlers via the
 * ActionRow once they exist; for now the actions are inert affordances.
 */
export function PostCard({
  post,
  reason,
  reply,
  variant = 'feed',
  hideActions = false,
  isThreadChild = false,
  connectBelow = false,
}: PostCardProps) {
  const navigate = useNavigate()
  const actions = usePostActions()
  const record = postRecord(post)
  const author = post.author
  const focused = variant === 'focused'
  const permalink = postPermalink(post)

  const isRepost =
    reason?.$type === 'app.bsky.feed.defs#reasonRepost'
      ? (reason as AppBskyFeedDefs.ReasonRepost)
      : null

  const open = () => {
    if (!focused) navigate(permalink)
  }

  // Reply context: in a feed row, surface the thread ROOT (first post) above a
  // reply. The root is only useful when it's a real, distinct post; we skip it
  // for the focused thread view and for thread children (which already show
  // their lineage via the reply tree). `connectBelow` posts (the rendered root
  // itself) never recurse — they're handed no `reply`.
  const rootView =
    !focused && !isThreadChild && reply && AppBskyFeedDefs.isPostView(reply.root)
      ? reply.root
      : null
  const showRoot = !!rootView && rootView.uri !== post.uri
  // A "⋮" gap is only meaningful when posts sit between root and this reply —
  // i.e. the immediate parent isn't the root itself.
  const parentIsRoot =
    !!rootView && AppBskyFeedDefs.isPostView(reply?.parent) && reply.parent.uri === rootView.uri
  const showGap = showRoot && !parentIsRoot

  const card = (
    <article
      className={clsx(
        'postcard',
        focused && 'postcard--focused',
        isThreadChild && 'postcard--thread-child',
        connectBelow && 'postcard--connect-below',
      )}
      onClick={open}
    >
      {isRepost && (
        <div className="postcard__reason">
          <RepostIcon size={14} />
          Reposted by {isRepost.by.displayName || `@${isRepost.by.handle}`}
        </div>
      )}

      {!focused && (
        <div className="postcard__gutter">
          <Link to={`/profile/${author.handle || author.did}`} onClick={(e) => e.stopPropagation()}>
            <Avatar src={author.avatar} alt={author.displayName || author.handle} size="md" />
          </Link>
        </div>
      )}

      <div className="postcard__main">
        {focused && (
          <div className="postcard__head">
            <Link
              to={`/profile/${author.handle || author.did}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar src={author.avatar} alt={author.displayName || author.handle} size="md" />
            </Link>
            <div>
              <div className="postcard__namerow">
                <BotBadge labels={author.labels} />
                <Link
                  to={`/profile/${author.handle || author.did}`}
                  className="postcard__name"
                  onClick={(e) => e.stopPropagation()}
                >
                  {author.displayName || author.handle}
                </Link>
              </div>
              <div className="postcard__handle">@{author.handle}</div>
            </div>
          </div>
        )}

        {!focused && (
          <div className="postcard__head">
            <BotBadge labels={author.labels} />
            <Link
              to={`/profile/${author.handle || author.did}`}
              className="postcard__name"
              onClick={(e) => e.stopPropagation()}
            >
              {author.displayName || author.handle}
            </Link>
            <span className="postcard__handle">@{author.handle}</span>
            <span className="postcard__dot">·</span>
            <time className="postcard__time" dateTime={record?.createdAt}>
              {relativeTime(record?.createdAt ?? post.indexedAt)}
            </time>
          </div>
        )}

        <LabelChips
          className="postcard__labels"
          labels={[...(post.labels ?? []), ...(post.author.labels ?? [])]}
        />

        {record && record.text.length > 0 && (
          <div className="postcard__body">
            <RichText
              text={record.text}
              facets={record.facets}
              omitLinkUris={previewedLinkUris(record, post.embed)}
            />
          </div>
        )}

        {post.embed &&
          !suppressImageEmbed(record, post.embed) &&
          !shouldDropExternalCard(record, post.embed) && <PostEmbed embed={post.embed} />}

        <ProviderLinkPreviews record={record} embed={post.embed} />

        {focused && record && (
          <div className="postcard__time" style={{ marginTop: 'var(--space-2)' }}>
            {absoluteTime(record.createdAt, { year: 'numeric' })}
          </div>
        )}

        {!hideActions && (
          <ActionRow
            post={post}
            onLike={actions ? () => actions.toggleLike(post) : undefined}
            onRepost={actions ? () => actions.toggleRepost(post) : undefined}
            onReply={actions ? () => actions.reply(post) : undefined}
            onShare={actions ? () => actions.share(post) : undefined}
          />
        )}
      </div>
    </article>
  )

  if (!showRoot) return card

  return (
    <div className="postcard-thread">
      {/* The thread's first post, connected down to the reply below. It gets no
          `reply` of its own, so it renders bare (no further context). */}
      <PostCard post={rootView!} variant="feed" connectBelow />
      {showGap && (
        <div
          className="postcard-thread__gap"
          onClick={open}
          role="button"
          tabIndex={0}
          aria-label="Show full thread"
        >
          <span className="postcard-thread__dots" aria-hidden>⋮</span>
        </div>
      )}
      {card}
    </div>
  )
}
