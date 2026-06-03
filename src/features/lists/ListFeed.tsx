import { useMemo } from 'react'
import type { AppBskyFeedDefs } from '@atproto/api'
import { EmptyState, ErrorState, Icons, InfiniteList, PostCard, Spinner } from '@/components'
import { useListFeed } from './use-list'

/** Feed tab (curate lists only): getListFeed of member posts. */
export function ListFeed({ listUri }: { listUri: string }) {
  const feed = useListFeed(listUri)
  const posts: AppBskyFeedDefs.FeedViewPost[] = useMemo(
    () => feed.data?.pages.flatMap((p) => p.feed) ?? [],
    [feed.data],
  )

  if (feed.isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <Spinner />
      </div>
    )
  }
  if (feed.isError) {
    return <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
  }

  return (
    <InfiniteList
      items={posts}
      getKey={(p) => p.post.uri + (p.reason ? '-r' : '')}
      estimateSize={140}
      scrollKey={`list:${listUri}`}
      hasNextPage={feed.hasNextPage}
      isFetchingNextPage={feed.isFetchingNextPage}
      fetchNextPage={feed.fetchNextPage}
      emptyState={
        <EmptyState
          icon={<Icons.ListIcon size={40} />}
          title="No posts"
          message="When members of this list post, their posts show up here."
        />
      }
      renderItem={(item) => (
        <PostCard
          post={item.post}
          reason={item.reason as AppBskyFeedDefs.ReasonRepost | undefined}
          reply={item.reply}
        />
      )}
    />
  )
}
