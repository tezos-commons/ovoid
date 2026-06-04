import { Link } from 'react-router-dom'
import type { AppBskyActorDefs, AppBskyFeedDefs } from '@atproto/api'
import { Avatar, Button, Text, Icons } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { useFeedPrefs, useSavedFeedsState } from './use-feed-prefs'
import { prefetchFeedFromGenerator } from './use-feed-view'

type GeneratorView = AppBskyFeedDefs.GeneratorView
type SavedFeed = AppBskyActorDefs.SavedFeed

/** Route to a feed's dedicated view from its generator AT-URI + creator. */
export function feedPermalink(gen: GeneratorView): string {
  const rkey = gen.uri.split('/').pop() ?? ''
  const actor = gen.creator.handle || gen.creator.did
  return `/profile/${actor}/feed/${rkey}`
}

interface FeedCardProps {
  feed: GeneratorView
  /**
   * Pre-resolved saved state for this feed. When omitted the card reads the
   * shared savedFeedsState query itself. Pass it down in lists so cards don't
   * each re-derive the lookup map.
   */
  savedState?: SavedFeed
  /** Hide the description line for denser list contexts. */
  compact?: boolean
}

/**
 * Discovery/list row for a single feed generator: square avatar, name, creator,
 * like count, description, and Pin / Save toggle buttons.
 *
 * Toggles write savedFeedsPrefV2 via useFeedPrefs. The toggle controls are only
 * rendered when authed — saving feeds requires an authed agent + preferences
 * write. The card itself (link to the feed view) is public-capable.
 */
export function FeedCard({ feed, savedState, compact }: FeedCardProps) {
  const { agent, did, isAuthed } = useAgent()
  const sharedState = useSavedFeedsState()
  const prefetchRef = usePrefetchOnVisible<HTMLDivElement>(() =>
    prefetchFeedFromGenerator(agent, did, feed),
  )
  const saved = savedState ?? sharedState.data?.byValue.get(feed.uri)

  const { pin, unpin, save, unsave } = useFeedPrefs()

  const isSaved = !!saved
  const isPinned = !!saved?.pinned
  const value = feed.uri

  const pinBusy = pin.isPending || unpin.isPending
  const saveBusy = save.isPending || unsave.isPending

  return (
    <div ref={prefetchRef} className="feedcard">
      <Link to={feedPermalink(feed)} className="feedcard__main">
        <Avatar
          src={feed.avatar}
          alt={feed.displayName}
          size="md"
          shape="rounded-square"
          fallback={feed.displayName}
        />
        <div className="feedcard__body">
          <Text as="div" weight="bold" className="feedcard__name">
            {feed.displayName}
          </Text>
          <Text as="div" size="sm" tone="muted">
            Feed by @{feed.creator.handle}
            {typeof feed.likeCount === 'number' && feed.likeCount > 0 && (
              <> · Liked by {feed.likeCount.toLocaleString()}</>
            )}
          </Text>
          {!compact && feed.description && (
            <Text as="p" size="sm" tone="muted" className="feedcard__desc">
              {feed.description}
            </Text>
          )}
        </div>
      </Link>

      {isAuthed && (
        <div className="feedcard__actions">
          <Button
            variant={isPinned ? 'primary' : 'secondary'}
            size="sm"
            loading={pinBusy}
            icon={<Icons.HashIcon size={16} filled={isPinned} />}
            onClick={() =>
              isPinned ? unpin.mutate({ value }) : pin.mutate({ value })
            }
            aria-pressed={isPinned}
          >
            {isPinned ? 'Pinned' : 'Pin'}
          </Button>
          <Button
            variant={isSaved ? 'secondary' : 'ghost'}
            size="sm"
            loading={saveBusy}
            icon={<Icons.BookmarkIcon size={16} filled={isSaved} />}
            onClick={() =>
              isSaved ? unsave.mutate({ value }) : save.mutate({ value })
            }
            aria-pressed={isSaved}
          >
            {isSaved ? 'Saved' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  )
}
