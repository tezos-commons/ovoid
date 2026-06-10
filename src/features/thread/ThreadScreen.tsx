import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { AppBskyFeedDefs } from '@atproto/api'
import { PostCard, ThreadSkeleton, FeedSkeleton, ErrorState, Tabs } from '@/components'
import { PageAside } from '@/components/layout'
import { useIsMobile } from '@/lib/use-is-mobile'
import {
  useThread,
  isThreadViewPost,
  isNotFoundPost,
  isBlockedPost,
  collectParents,
  collectThreadAuthors,
} from './use-thread'
import { ThreadAuthors } from './ThreadAuthors'
import { useThreadHover } from './thread-hover-store'
import { ReplyTree } from './ReplyTree'
import { ReplyComposer } from './ReplyComposer'
import './thread.css'

type SortKey = 'top' | 'newest' | 'oldest'

const SORT_TABS = [
  { key: 'top', label: 'Top' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
]

/**
 * Post permalink / thread screen for /profile/:actor/post/:rkey.
 *
 * Layout (top -> bottom): sticky header, parent ancestor chain (connected),
 * the focused post (enlarged `focused` PostCard variant), the inline reply
 * composer, a reply-sort control, then the threaded reply subtree.
 *
 * Public-capable: getPostThread serves signed-out against the public AppView;
 * the composer renders a sign-in prompt instead of a textarea when unauthed.
 */
export default function ThreadScreen() {
  const { actor = '', rkey = '' } = useParams()
  const { data, isLoading, isPlaceholderData, isError, error, refetch } = useThread(actor, rkey)
  const [sort, setSort] = useState<SortKey>('top')
  const isMobile = useIsMobile()

  // Hovering a post highlights its author in the aside grid. One delegated
  // handler reads the nearest [data-author-did] so the post tree needs no
  // per-post wiring or re-render; the grid subscribes to the store.
  const setHovered = useThreadHover((s) => s.setHovered)
  useEffect(() => () => setHovered(null), [setHovered])
  const onThreadHover = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-author-did]')
    setHovered(el?.getAttribute('data-author-did') ?? null)
  }

  // Scroll the focused post into view on load so the parent chain doesn't push
  // it off-screen when the chain is tall. One-shot: the placeholder→real data
  // swap changes `data` identity, and re-scrolling then would yank the viewport
  // out from under the user.
  const focusedRef = useRef<HTMLDivElement>(null)
  const didFocusScroll = useRef(false)
  useEffect(() => {
    if (data && !didFocusScroll.current) {
      didFocusScroll.current = true
      focusedRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [data])

  if (isLoading) {
    return <ThreadSkeleton />
  }

  if (isError) {
    return (
      <>
        <ErrorState error={error} onRetry={() => refetch()} title="Couldn't load thread" />
      </>
    )
  }

  const node = data?.thread

  if (isNotFoundPost(node)) {
    return (
      <>
        <div className="thread-stub">This post was deleted or could not be found.</div>
      </>
    )
  }

  if (isBlockedPost(node)) {
    return (
      <>
        <div className="thread-stub">This post is from a blocked account.</div>
      </>
    )
  }

  if (!isThreadViewPost(node)) {
    return (
      <>
        <div className="thread-stub">This post is unavailable.</div>
      </>
    )
  }

  const { ancestors, brokenTop } = collectParents(node)
  const replies = sortReplies(node.replies, sort)
  const authors = collectThreadAuthors(node)

  return (
    <>
      {/* The author cards are aside-only context; on mobile they'd just stack
          above the thread, so drop them entirely (and skip their profile fetch). */}
      {!isMobile && (
        <PageAside>
          <ThreadAuthors authors={authors} focusedDid={node.post.author.did} />
        </PageAside>
      )}

      <div className="thread" onMouseOver={onThreadHover} onMouseLeave={() => setHovered(null)}>
        {/* Parent ancestor chain — oldest first, each connected to the next. */}
        {brokenTop && (
          <div className="thread-stub thread-stub--child">
            The start of this thread is unavailable.
          </div>
        )}
        {ancestors.map((a) => (
          <div key={a.post.uri} className="thread__parent" data-author-did={a.post.author.did}>
            <PostCard post={a.post} isThreadChild />
          </div>
        ))}

        {/* Focused post — enlarged variant. */}
        <div
          ref={focusedRef}
          className="thread__focused"
          id="focused-post"
          data-author-did={node.post.author.did}
        >
          <PostCard post={node.post} variant="focused" />
        </div>

        {/* Inline reply composer (or sign-in prompt). */}
        <ReplyComposer parent={node.post} />

        {/* Reply sort + subtree. A placeholder thread is a single synthesized
            node — its replies haven't arrived, so show a skeleton instead of
            claiming there are none. */}
        {hasReplies(node) ? (
          <>
            <div className="thread__sort">
              <Tabs
                items={SORT_TABS}
                activeKey={sort}
                onChange={(k) => setSort(k as SortKey)}
              />
            </div>
            <ReplyTree replies={replies} />
          </>
        ) : isPlaceholderData ? (
          <FeedSkeleton count={3} />
        ) : (
          <div className="thread-empty">No replies yet. Be the first.</div>
        )}
      </div>
    </>
  )
}

function hasReplies(node: AppBskyFeedDefs.ThreadViewPost): boolean {
  return Array.isArray(node.replies) && node.replies.some(isThreadViewPost)
}

/**
 * Re-order direct replies by the chosen key. Only top-level ordering is changed;
 * deeper levels keep the AppView's order. 'top' approximates engagement using
 * like+repost+reply counts (the AppView doesn't expose a true "hot" score
 * client-side, so this is the closest faithful proxy).
 */
function sortReplies(
  replies: AppBskyFeedDefs.ThreadViewPost['replies'],
  sort: SortKey,
): AppBskyFeedDefs.ThreadViewPost['replies'] {
  if (!replies) return replies
  const arr = [...replies]
  arr.sort((a, b) => {
    const av = isThreadViewPost(a) ? a : null
    const bv = isThreadViewPost(b) ? b : null
    // Non-post stubs sink to the bottom regardless of sort.
    if (!av && !bv) return 0
    if (!av) return 1
    if (!bv) return -1
    switch (sort) {
      case 'newest':
        return time(bv.post) - time(av.post)
      case 'oldest':
        return time(av.post) - time(bv.post)
      case 'top':
      default:
        return score(bv.post) - score(av.post)
    }
  })
  return arr
}

function score(post: AppBskyFeedDefs.PostView): number {
  return (post.likeCount ?? 0) * 2 + (post.repostCount ?? 0) * 2 + (post.replyCount ?? 0)
}

function time(post: AppBskyFeedDefs.PostView): number {
  return new Date(post.indexedAt).getTime()
}
