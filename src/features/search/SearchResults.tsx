import { useMemo } from 'react'
import type { AppBskyActorDefs, AppBskyFeedDefs } from '@atproto/api'
import {
  InfiniteList,
  PostCard,
  ErrorState,
  EmptyState,
  Spinner,
  FeedSkeleton,
  PeopleSkeleton,
  Icons,
} from '@/components'
import { useSearchPosts, type PostSort } from './use-search-posts'
import { useSearchActors } from './use-search-actors'
import { usePopularFeeds } from './use-discover'
import { PersonCard } from './PersonCard'
import { FeedCard } from './FeedCard'

function LoadingState() {
  return (
    <div className="search__center">
      <Spinner />
    </div>
  )
}

/* ---------------- Posts (Top / Latest) ---------------- */

export function PostResults({ q, sort }: { q: string; sort: PostSort }) {
  const query = useSearchPosts(q, sort)
  const posts = useMemo(
    () => query.data?.pages.flatMap((p) => p.posts) ?? [],
    [query.data],
  )

  if (query.isLoading) return <FeedSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  return (
    <InfiniteList<AppBskyFeedDefs.PostView>
      items={posts}
      getKey={(p) => p.uri}
      estimateSize={140}
      scrollKey={`search:posts:${sort}:${q}`}
      hasNextPage={query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      fetchNextPage={query.fetchNextPage}
      fadeTopBarOnScroll
      renderItem={(post) => <PostCard post={post} />}
      emptyState={
        <EmptyState
          icon={<Icons.SearchIcon size={32} />}
          title="No posts found"
          message={`Nothing matched "${q.trim()}". Try different keywords.`}
        />
      }
    />
  )
}

/* ---------------- People ---------------- */

export function PeopleResults({ q }: { q: string }) {
  const query = useSearchActors(q)
  const actors = useMemo(
    () => query.data?.pages.flatMap((p) => p.actors) ?? [],
    [query.data],
  )

  if (query.isLoading) return <PeopleSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  return (
    <InfiniteList<AppBskyActorDefs.ProfileView>
      items={actors}
      getKey={(a) => a.did}
      estimateSize={84}
      scrollKey={`search:people:${q}`}
      hasNextPage={query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      fetchNextPage={query.fetchNextPage}
      fadeTopBarOnScroll
      renderItem={(actor) => <PersonCard actor={actor} />}
      emptyState={
        <EmptyState
          icon={<Icons.PersonIcon size={32} />}
          title="No people found"
          message={`No accounts matched "${q.trim()}".`}
        />
      }
    />
  )
}

/* ---------------- Feeds ----------------
   No first-class "search feeds" endpoint exists; the unspecced popular-feeds
   generator accepts an optional query string, so we use it as the closest
   working feed-search. Isolated behind use-discover. */

export function FeedResults({ q }: { q: string }) {
  const query = usePopularFeeds(q)
  const feeds = query.data ?? []

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  if (feeds.length === 0) {
    return (
      <EmptyState
        icon={<Icons.HashIcon size={32} />}
        title="No feeds found"
        message={`No custom feeds matched "${q.trim()}".`}
      />
    )
  }

  return (
    <div className="search__list">
      {feeds.map((feed) => (
        <FeedCard key={feed.uri} feed={feed} />
      ))}
    </div>
  )
}
