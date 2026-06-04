import { Link } from 'react-router-dom'
import { PeopleSkeleton, Icons } from '@/components'
import { useTrending, useSuggestedActors, usePopularFeeds } from './use-discover'
import { PersonCard } from './PersonCard'
import { FeedCard } from './FeedCard'

/**
 * The pre-query state shown when the search box is empty: trending search terms,
 * suggested accounts, and discover feeds. Every block degrades to nothing if its
 * (often unspecced) source is unavailable, so the screen never errors here.
 */
export function DiscoverState() {
  const trending = useTrending()
  const suggested = useSuggestedActors(6)
  const feeds = usePopularFeeds(undefined, 6)

  const trends = trending.data ?? []
  const actors = suggested.data ?? []
  const feedList = feeds.data ?? []

  const loadingAll =
    trending.isLoading && suggested.isLoading && feeds.isLoading

  if (loadingAll) {
    return <PeopleSkeleton />
  }

  return (
    <div className="discover">
      {trends.length > 0 && (
        <section className="discover__section">
          <h2 className="discover__title">
            <Icons.SearchIcon size={16} /> Trending
          </h2>
          <div className="discover__chips">
            {trends.map((t) => (
              <Link key={t.topic} to={t.link} className="chip">
                {t.topic}
              </Link>
            ))}
          </div>
        </section>
      )}

      {actors.length > 0 && (
        <section className="discover__section">
          <h2 className="discover__title">
            <Icons.PersonIcon size={16} /> Suggested accounts
          </h2>
          <div className="search__list">
            {actors.map((actor) => (
              <PersonCard key={actor.did} actor={actor} />
            ))}
          </div>
        </section>
      )}

      {feedList.length > 0 && (
        <section className="discover__section">
          <h2 className="discover__title">
            <Icons.HashIcon size={16} /> Discover feeds
          </h2>
          <div className="search__list">
            {feedList.map((feed) => (
              <FeedCard key={feed.uri} feed={feed} />
            ))}
          </div>
        </section>
      )}

      {trends.length === 0 && actors.length === 0 && feedList.length === 0 && (
        <div className="search__center search__center--muted">
          Search for people, posts and feeds.
        </div>
      )}
    </div>
  )
}
