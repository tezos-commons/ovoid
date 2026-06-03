import { useEffect, useRef } from 'react'
import type { AppBskyFeedDefs } from '@atproto/api'
import { PostCard, Spinner, ErrorState, EmptyState } from '@/components'
import { useWindowScrollRestoration } from '@/lib/scroll-restoration'

interface FeedPage {
  feed: AppBskyFeedDefs.FeedViewPost[]
  cursor?: string
}

/**
 * The minimal slice of an infinite-query result this list consumes. Declaring
 * it structurally (rather than UseInfiniteQueryResult<…>) lets both
 * getAuthorFeed and getActorLikes pass their own typed results without a cast,
 * sidestepping React Query's invariant generic on the data shape.
 */
export interface FeedQueryLike {
  data?: { pages: FeedPage[] }
  isLoading: boolean
  isError: boolean
  error: unknown
  hasNextPage?: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  refetch: () => void
}

export interface ProfileFeedProps {
  query: FeedQueryLike
  emptyTitle: string
  emptyMessage?: string
  /** Stable id so the window scroll position is restored on back-navigation. */
  scrollKey?: string
}

/**
 * Renders an author/likes feed inline within the profile screen's own scroll
 * (so the banner scrolls away and the tab strip sticks). Pagination is driven
 * by an IntersectionObserver sentinel rather than InfiniteList's internal
 * scroll container, which would otherwise nest a second scroll region.
 *
 * Feed-level dedup: getAuthorFeed with includePins can surface the pinned post
 * twice (once pinned, once in-stream). We key by post uri + reason so React
 * doesn't collide keys, and skip a reply's parent-only rows that lack a post.
 */
export function ProfileFeed({ query, emptyTitle, emptyMessage, scrollKey }: ProfileFeedProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  useWindowScrollRestoration(scrollKey)

  const items: AppBskyFeedDefs.FeedViewPost[] =
    query.data?.pages.flatMap((p) => p.feed) ?? []

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, items.length])

  if (query.isLoading) {
    return (
      <div className="proffeed__center">
        <Spinner />
      </div>
    )
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />
  }

  return (
    <div className="proffeed">
      {items.map((item, i) => {
        const reason = item.reason as AppBskyFeedDefs.FeedViewPost['reason']
        const reasonKey =
          reason?.$type === 'app.bsky.feed.defs#reasonRepost' ? 'repost' : 'post'
        return (
          <PostCard
            key={`${item.post.uri}:${reasonKey}:${i}`}
            post={item.post}
            reason={item.reason as never}
            reply={item.reply}
          />
        )
      })}
      <div ref={sentinel} className="proffeed__sentinel">
        {query.isFetchingNextPage && <Spinner size="sm" />}
      </div>
    </div>
  )
}
