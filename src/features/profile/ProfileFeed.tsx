import { useEffect, useRef } from 'react'
import { useNavigationType } from 'react-router-dom'
import { useWindowVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import type { AppBskyFeedDefs } from '@atproto/api'
import { PostCard, Spinner, FeedSkeleton, ErrorState, EmptyState } from '@/components'
import { useFadeTopBarOnScroll } from '@/components/layout'
import { getSavedWindowScroll, useWindowScrollRestoration } from '@/lib/scroll-restoration'

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
 * Measured row heights per scrollKey — the same pattern as InfiniteList's
 * scrollMemory. useWindowScrollRestoration puts the window back at the saved
 * scrollY; without the measurement cache a fresh virtualizer would re-estimate
 * every row and that offset would land at a different logical position.
 */
const measurementsMemory = new Map<string, VirtualItem[]>()

/** Feed-level dedup key: getAuthorFeed with includePins can surface the pinned
 *  post twice (once pinned, once in-stream), so the uri alone can collide. */
function rowKey(item: AppBskyFeedDefs.FeedViewPost, i: number): string {
  const reasonKey =
    item.reason?.$type === 'app.bsky.feed.defs#reasonRepost' ? 'repost' : 'post'
  return `${item.post.uri}:${reasonKey}:${i}`
}

/**
 * Renders an author/likes feed inline within the profile screen's own scroll
 * (so the banner scrolls away and the tab strip sticks). Virtualized against
 * the WINDOW scroll — InfiniteList's internal scroll container would nest a
 * second scroll region here — so the DOM stays bounded however deep the user
 * pages. Pagination is driven by an IntersectionObserver sentinel below the
 * virtual range.
 */
export function ProfileFeed({ query, emptyTitle, emptyMessage, scrollKey }: ProfileFeedProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isPop = useNavigationType() === 'POP'
  useWindowScrollRestoration(scrollKey)
  // Mobile: fade the top bar on scroll-down / in on scroll-up. Profile feeds are
  // window-scrolled (no ref → window).
  useFadeTopBarOnScroll()

  const items: AppBskyFeedDefs.FeedViewPost[] =
    query.data?.pages.flatMap((p) => p.feed) ?? []

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 150,
    overscan: 6,
    // 0 on the very first render (ref not attached yet); the post-mount
    // re-render reads the real offset, and overscan covers the gap meanwhile.
    scrollMargin: listRef.current?.offsetTop ?? 0,
    getItemKey: (i) => rowKey(items[i], i),
    // Seed the SAME offset useWindowScrollRestoration is about to apply: 0 on
    // forward navigation, the saved offset on POP. The library's default
    // initialOffset is the CURRENT window.scrollY — at construction that is
    // still the PREVIOUS screen's depth, so its scroll-anchoring
    // (resizeItem → applyScrollAdjustment) would "preserve" that stale offset
    // by scrolling the window back down after our reset (the bug seen live:
    // scrollTo(~10980) from applyScrollAdjustment after profile→profile nav).
    initialOffset: isPop ? getSavedWindowScroll(scrollKey) ?? 0 : 0,
    // Measurements are positions from a previous visit — only valid alongside
    // the restored offset. Seeding them on a forward nav (fresh entry at top)
    // feeds resizeItem deltas for rows that aren't even rendered yet.
    initialMeasurementsCache:
      isPop && scrollKey ? measurementsMemory.get(scrollKey) : undefined,
  })

  // Persist measured heights at unmount so back-navigation restores exactly.
  useEffect(() => {
    if (!scrollKey) return
    return () => {
      measurementsMemory.set(scrollKey, virtualizer.measurementsCache)
    }
  }, [scrollKey, virtualizer])

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
    return <FeedSkeleton />
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />
  }

  return (
    <div className="proffeed" ref={listRef}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const item = items[vi.index]
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <PostCard
                post={item.post}
                reason={item.reason as never}
                reply={item.reply}
              />
            </div>
          )
        })}
      </div>
      <div ref={sentinel} className="proffeed__sentinel">
        {query.isFetchingNextPage && <Spinner size="sm" />}
      </div>
    </div>
  )
}
