import { Link } from 'react-router-dom'
import type {
  AppBskyFeedDefs,
  AppBskyGraphDefs,
} from '@atproto/api'
import { Avatar, Spinner, ErrorState, EmptyState } from '@/components'
import { HeartIcon } from '@/components/Icon'
import { useAgent } from '@/lib/api/agent'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { prefetchFeedFromGenerator } from '@/features/feeds/use-feed-view'
import { prefetchListFromView } from '@/features/lists/use-list'
import { useAuthorFeeds, useAuthorLists } from './use-author-feeds'

/** One created-feed row; warms the feed-view route once it dwells on screen. */
function FeedRow({ feed }: { feed: AppBskyFeedDefs.GeneratorView }) {
  const { agent, did } = useAgent()
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() =>
    prefetchFeedFromGenerator(agent, did, feed),
  )
  const rkey = feed.uri.split('/').pop() ?? ''
  return (
    <Link
      ref={prefetchRef}
      to={`/profile/${feed.creator.handle || feed.creator.did}/feed/${rkey}`}
      className="profcard"
    >
      <Avatar src={feed.avatar} alt={feed.displayName} size="lg" shape="rounded-square" />
      <div className="profcard__meta">
        <span className="profcard__name">{feed.displayName}</span>
        <span className="profcard__sub">
          Feed by @{feed.creator.handle}
          {typeof feed.likeCount === 'number' && (
            <>
              {' · '}
              <HeartIcon size={12} /> {feed.likeCount}
            </>
          )}
        </span>
        {feed.description && <span className="profcard__desc">{feed.description}</span>}
      </div>
    </Link>
  )
}

/** Custom feeds the actor created. */
export function ProfileFeedsTab({ actor }: { actor: string }) {
  const q = useAuthorFeeds(actor)
  const feeds: AppBskyFeedDefs.GeneratorView[] =
    q.data?.pages.flatMap((p) => p.feeds) ?? []

  if (q.isLoading)
    return (
      <div className="proffeed__center">
        <Spinner />
      </div>
    )
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (feeds.length === 0) return <EmptyState title="No feeds" />

  return (
    <div className="proflist">
      {feeds.map((f) => (
        <FeedRow key={f.uri} feed={f} />
      ))}
    </div>
  )
}

const purposeLabel = (p: string) =>
  p.endsWith('modlist') ? 'Moderation list' : p.endsWith('referencelist') ? 'Starter pack' : 'User list'

/** One owned-list row; warms the list-detail route once it dwells on screen. */
function ListRow({ list }: { list: AppBskyGraphDefs.ListView }) {
  const { agent, did } = useAgent()
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() =>
    prefetchListFromView(agent, did, list),
  )
  const rkey = list.uri.split('/').pop() ?? ''
  return (
    <Link
      ref={prefetchRef}
      to={`/profile/${list.creator.handle || list.creator.did}/lists/${rkey}`}
      className="profcard"
    >
      <Avatar src={list.avatar} alt={list.name} size="lg" shape="rounded-square" />
      <div className="profcard__meta">
        <span className="profcard__name">{list.name}</span>
        <span className="profcard__sub">
          {purposeLabel(list.purpose)} · by @{list.creator.handle}
        </span>
        {list.description && <span className="profcard__desc">{list.description}</span>}
      </div>
    </Link>
  )
}

/** Lists the actor owns. */
export function ProfileListsTab({ actor }: { actor: string }) {
  const q = useAuthorLists(actor)
  const lists: AppBskyGraphDefs.ListView[] = q.data?.pages.flatMap((p) => p.lists) ?? []

  if (q.isLoading)
    return (
      <div className="proffeed__center">
        <Spinner />
      </div>
    )
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (lists.length === 0) return <EmptyState title="No lists" />

  return (
    <div className="proflist">
      {lists.map((l) => (
        <ListRow key={l.uri} list={l} />
      ))}
    </div>
  )
}
