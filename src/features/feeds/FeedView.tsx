import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { AppBskyFeedDefs } from '@atproto/api'
import { ScreenHeader, useHideMobileTopBar } from '@/components/layout'
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  FeedSkeleton,
  InfiniteList,
  Menu,
  PostCard,
  Skeleton,
  Text,
  Icons,
} from '@/components'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { profileOptions } from '@/features/profile/use-profile'
import {
  flattenFeed,
  useFeedGenerator,
  useFeedLike,
  useFeedPosts,
  useGeneratorUri,
} from './use-feed-view'
import { useFeedPrefs, useSavedFeedsState } from './use-feed-prefs'
import './feeds.css'

type FeedViewPost = AppBskyFeedDefs.FeedViewPost

/**
 * /profile/:actor/feed/:rkey — a single custom feed.
 *
 * Resolves the generator AT-URI from actor+rkey, shows the generator header
 * (avatar/name/creator/description + pin/save/like actions), then the feed's
 * posts via getFeed (infinite). Public-capable: signed-out viewers see the feed
 * and header but the save/pin/like controls are hidden (they require an authed
 * preferences/like write).
 */
export default function FeedView() {
  const { actor = '', rkey = '' } = useParams()
  const { isAuthed } = useAgent()
  // Mobile: this screen has its own in-content feed header (name/avatar/actions),
  // so the floating top bar would just be an empty glass pill over it. Suppress
  // it (back is via edge-swipe) — same as the thread/post view.
  useHideMobileTopBar()

  const uriQuery = useGeneratorUri(actor, rkey)
  const uri = uriQuery.data

  const gen = useFeedGenerator(uri)
  const posts = useFeedPosts(uri)

  const items = useMemo(
    () => flattenFeed(posts.data?.pages),
    [posts.data],
  )

  // The URI resolution failing means the route actor/handle is unresolvable.
  if (uriQuery.isError) {
    return (
      <>
        <ScreenHeader title="Feed" showBack />
        <ErrorState
          error={uriQuery.error}
          onRetry={() => uriQuery.refetch()}
          title="Couldn't resolve this feed"
        />
      </>
    )
  }

  return (
    <>
      <ScreenHeader
        title={gen.data?.displayName ?? 'Feed'}
        showBack
        actions={
          gen.data ? (
            <HeaderActions feed={gen.data} authed={isAuthed} />
          ) : undefined
        }
      />

      {gen.isLoading || uriQuery.isLoading ? (
        <FeedHeaderSkeleton />
      ) : gen.isError ? (
        <ErrorState error={gen.error} onRetry={() => gen.refetch()} />
      ) : gen.data ? (
        <FeedHeader feed={gen.data} authed={isAuthed} />
      ) : null}

      {posts.isLoading ? (
        <FeedSkeleton />
      ) : posts.isError ? (
        <ErrorState error={posts.error} onRetry={() => posts.refetch()} />
      ) : (
        <InfiniteList<FeedViewPost>
          items={items}
          getKey={(it) =>
            it.post.uri + (it.reason ? '·' + (it.reason as { $type?: string }).$type : '')
          }
          estimateSize={140}
          scrollKey={`feed:${uri}`}
          hasNextPage={posts.hasNextPage}
          isFetchingNextPage={posts.isFetchingNextPage}
          fetchNextPage={posts.fetchNextPage}
          emptyState={
            <EmptyState
              icon={<Icons.HashIcon size={32} />}
              title="This feed is empty"
              message="The generator returned no posts right now."
            />
          }
          renderItem={(it) => (
            <PostCard
              post={it.post}
              reason={it.reason as AppBskyFeedDefs.ReasonRepost | undefined}
              reply={it.reply}
            />
          )}
        />
      )}
    </>
  )
}

/* ---------------------- header (description block) ---------------------- */

function FeedHeader({
  feed,
  authed,
}: {
  feed: AppBskyFeedDefs.GeneratorView
  authed: boolean
}) {
  // Creator link → warm their profile on dwell.
  const { agent } = useAgent()
  const creatorRef = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const profile = profileOptions(agent, feed.creator.handle || feed.creator.did)
    schedulePrefetch(profile.queryKey, () => queryClient.prefetchQuery(profile))
  })
  return (
    <div className="feedview__header">
      <div className="feedview__top">
        <Avatar
          src={feed.avatar}
          alt={feed.displayName}
          size="xl"
          shape="rounded-square"
          fallback={feed.displayName}
        />
        <div className="feedview__meta">
          <Text as="h1" size="xl" weight="bold">
            {feed.displayName}
          </Text>
          <Link
            to={`/profile/${feed.creator.handle || feed.creator.did}`}
            className="feedview__creator"
            ref={creatorRef}
          >
            <Text size="sm" tone="muted">
              Feed by @{feed.creator.handle}
            </Text>
          </Link>
        </div>
      </div>

      {feed.description && (
        <Text as="p" size="base" className="feedview__desc">
          {feed.description}
        </Text>
      )}

      <div className="feedview__stats">
        {typeof feed.likeCount === 'number' && (
          <Text size="sm" tone="muted">
            <strong>{feed.likeCount.toLocaleString()}</strong> likes
          </Text>
        )}
        {authed && <LikeButton feed={feed} />}
      </div>

      {authed && <PinSaveRow feed={feed} />}
    </div>
  )
}

/* ---------------------- header actions (overflow + pin) ---------------------- */

function HeaderActions({
  feed,
  authed,
}: {
  feed: AppBskyFeedDefs.GeneratorView
  authed: boolean
}) {
  const saved = useSavedFeedsState()
  const state = saved.data?.byValue.get(feed.uri)
  const isPinned = !!state?.pinned
  const isSaved = !!state
  const { pin, unpin, save, unsave } = useFeedPrefs()
  const value = feed.uri

  if (!authed) return null

  return (
    <Menu
      trigger={
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Icons.MoreIcon size={20} />}
          aria-label="Feed options"
        />
      }
      items={[
        {
          key: 'pin',
          label: isPinned ? 'Unpin from Home' : 'Pin to Home',
          onSelect: () =>
            isPinned ? unpin.mutate({ value }) : pin.mutate({ value }),
        },
        {
          key: 'save',
          label: isSaved ? 'Remove from My Feeds' : 'Save feed',
          danger: isSaved,
          onSelect: () =>
            isSaved ? unsave.mutate({ value }) : save.mutate({ value }),
        },
      ]}
    />
  )
}

/* ---------------------- pin / save / like controls ---------------------- */

function PinSaveRow({ feed }: { feed: AppBskyFeedDefs.GeneratorView }) {
  const saved = useSavedFeedsState()
  const state = saved.data?.byValue.get(feed.uri)
  const isPinned = !!state?.pinned
  const isSaved = !!state
  const { pin, unpin, save, unsave } = useFeedPrefs()
  const value = feed.uri

  const pinBusy = pin.isPending || unpin.isPending
  const saveBusy = save.isPending || unsave.isPending

  return (
    <div className="feedview__actions">
      <Button
        variant={isPinned ? 'primary' : 'secondary'}
        size="md"
        loading={pinBusy}
        icon={<Icons.HashIcon size={18} filled={isPinned} />}
        onClick={() =>
          isPinned ? unpin.mutate({ value }) : pin.mutate({ value })
        }
        aria-pressed={isPinned}
      >
        {isPinned ? 'Pinned' : 'Pin to Home'}
      </Button>
      <Button
        variant={isSaved ? 'secondary' : 'ghost'}
        size="md"
        loading={saveBusy}
        icon={<Icons.BookmarkIcon size={18} filled={isSaved} />}
        onClick={() =>
          isSaved ? unsave.mutate({ value }) : save.mutate({ value })
        }
        aria-pressed={isSaved}
      >
        {isSaved ? 'Saved' : 'Save'}
      </Button>
    </div>
  )
}

function LikeButton({ feed }: { feed: AppBskyFeedDefs.GeneratorView }) {
  const likeUri = feed.viewer?.like
  const liked = !!likeUri
  const like = useFeedLike(feed.uri)
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={like.isPending}
      icon={
        <Icons.HeartIcon
          size={18}
          filled={liked}
          className={liked ? 'feedview__heart--active' : undefined}
        />
      }
      onClick={() => like.mutate({ cid: feed.cid, likeUri })}
      aria-pressed={liked}
    >
      {liked ? 'Liked' : 'Like'}
    </Button>
  )
}

/* ---------------------- skeleton ---------------------- */

function FeedHeaderSkeleton() {
  return (
    <div className="feedview__header" aria-hidden>
      <div className="feedview__top">
        <Skeleton width={64} height={64} radius={8} />
        <div className="feedview__meta">
          <Skeleton width={180} height={22} />
          <Skeleton width={120} height={14} />
        </div>
      </div>
      <Skeleton width="90%" height={14} />
      <Skeleton width="70%" height={14} />
    </div>
  )
}
