import { useMemo } from 'react'
import type { UseInfiniteQueryResult } from '@tanstack/react-query'
import type { AppBskyFeedDefs } from '@atproto/api'
import {
  PostCard,
  InfiniteList,
  ErrorState,
  EmptyState,
  Spinner,
  Icons,
} from '@/components'

type FeedPage = { feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string }

interface FeedViewProps {
  query: UseInfiniteQueryResult<{ pages: FeedPage[] }, unknown>
  /** Count of fresh items detected above the fold (drives the pill). */
  newItemsCount?: number
  onNewItems?: () => void
  emptyMessage?: string
  /** Stable id so scroll position is restored when returning from a thread. */
  scrollKey?: string
}

/**
 * Renders a paginated feed of PostCards. Interactions (like/repost/reply/share)
 * are wired by PostCard itself via the PostActions context — no per-surface
 * delegation needed.
 */
export function FeedView({
  query,
  newItemsCount = 0,
  onNewItems,
  emptyMessage = 'Nothing here yet.',
  scrollKey,
}: FeedViewProps) {
  const items = useMemo<AppBskyFeedDefs.FeedViewPost[]>(
    () => query.data?.pages.flatMap((p) => p.feed) ?? [],
    [query.data],
  )

  if (query.isError && items.length === 0) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }

  if (query.isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-6)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <InfiniteList<AppBskyFeedDefs.FeedViewPost>
      items={items}
      getKey={(it) => feedItemKey(it)}
      estimateSize={140}
      scrollKey={scrollKey}
      hasNextPage={query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      fetchNextPage={() => void query.fetchNextPage()}
      newItemsCount={newItemsCount}
      onNewItems={onNewItems}
      emptyState={
        <EmptyState icon={<Icons.HomeIcon size={28} />} title="No posts" message={emptyMessage} />
      }
      renderItem={(it) => (
        <PostCard
          post={it.post}
          reason={it.reason as AppBskyFeedDefs.ReasonRepost | undefined}
          reply={it.reply}
        />
      )}
    />
  )
}

/**
 * A stable key. Reposts surface the same post.uri under different viewers, so we
 * fold the reposter DID into the key to keep React keys unique across reposts.
 */
function feedItemKey(it: AppBskyFeedDefs.FeedViewPost): string {
  const reason = it.reason as { by?: { did?: string } } | undefined
  const reposter = reason?.by?.did
  return reposter ? `${it.post.uri}|repost:${reposter}` : it.post.uri
}
