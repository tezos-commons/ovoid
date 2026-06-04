import { Link } from 'react-router-dom'
import type { AppBskyFeedDefs } from '@atproto/api'
import { Avatar, Icons } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { prefetchFeedFromGenerator } from '@/features/feeds/use-feed-view'

export interface FeedCardProps {
  feed: AppBskyFeedDefs.GeneratorView
}

/** AT-URI -> the local feed-view route /profile/:actor/feed/:rkey. */
function feedPermalink(feed: AppBskyFeedDefs.GeneratorView): string {
  const rkey = feed.uri.split('/').pop() ?? ''
  const actor = feed.creator.handle || feed.creator.did
  return `/profile/${actor}/feed/${rkey}`
}

/**
 * A feed-generator result row for the Feeds tab. Pin/Save toggles belong to
 * feeds/use-feed-prefs (preferences read-modify-write) and are deliberately not
 * reimplemented here; the row links to the canonical feed view where those live.
 */
export function FeedCard({ feed }: FeedCardProps) {
  const { agent, did } = useAgent()
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() =>
    prefetchFeedFromGenerator(agent, did, feed),
  )
  return (
    <Link ref={prefetchRef} to={feedPermalink(feed)} className="feedrow">
      <Avatar
        src={feed.avatar}
        alt={feed.displayName}
        size="md"
        shape="rounded-square"
        fallback={feed.displayName}
      />
      <div className="feedrow__body">
        <div className="feedrow__name">{feed.displayName}</div>
        <div className="feedrow__meta">
          Feed by @{feed.creator.handle}
          {typeof feed.likeCount === 'number' && feed.likeCount > 0 && (
            <>
              {' · '}
              <span className="feedrow__likes">
                <Icons.HeartIcon size={12} /> {feed.likeCount}
              </span>
            </>
          )}
        </div>
        {feed.description && <div className="feedrow__desc">{feed.description}</div>}
      </div>
    </Link>
  )
}
