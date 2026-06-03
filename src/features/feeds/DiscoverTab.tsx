import { useMemo, useState } from 'react'
import { EmptyState, ErrorState, Spinner, Icons } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { FeedCard } from './FeedCard'
import { useDiscoverFeeds, useSuggestedFeeds } from './use-discover-feeds'
import { useSavedFeedsState } from './use-feed-prefs'
import { SectionHeader, FeedListSkeleton } from './FeedSection'

/**
 * Discover tab: personalized suggestions (getSuggestedFeeds, authed only) +
 * popular generators (unspecced.getPopularFeedGenerators), searchable and
 * paginated.
 */
export function DiscoverTab() {
  const { isAuthed } = useAgent()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')

  const suggested = useSuggestedFeeds()
  const discover = useDiscoverFeeds(query)
  const saved = useSavedFeedsState()
  const lookup = saved.data?.byValue

  const popular = useMemo(
    () => discover.data?.pages.flatMap((p) => p.feeds) ?? [],
    [discover.data],
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(draft.trim())
  }

  return (
    <div className="feeds__discover">
      <form className="feeds__search" onSubmit={submit} role="search">
        <Icons.SearchIcon size={18} className="feeds__search-icon" />
        <input
          className="feeds__search-input"
          type="search"
          placeholder="Search feeds"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Search feeds"
        />
      </form>

      {/* Personalized suggestions only when authed and not actively searching. */}
      {isAuthed && !query && (suggested.data?.length ?? 0) > 0 && (
        <>
          <SectionHeader
            icon={<Icons.PersonIcon size={16} />}
            label="Suggested for you"
          />
          {suggested.data!.map((f) => (
            <FeedCard key={f.uri} feed={f} savedState={lookup?.get(f.uri)} />
          ))}
        </>
      )}

      <SectionHeader
        icon={<Icons.HashIcon size={16} />}
        label={query ? `Results for “${query}”` : 'Popular feeds'}
      />

      {discover.isLoading ? (
        <FeedListSkeleton />
      ) : discover.isError ? (
        <ErrorState error={discover.error} onRetry={() => discover.refetch()} />
      ) : popular.length === 0 ? (
        <EmptyState
          icon={<Icons.SearchIcon size={32} />}
          title={query ? 'No feeds found' : 'No popular feeds'}
          message={query ? 'Try a different search term.' : undefined}
        />
      ) : (
        <div className="feeds__list">
          {popular.map((f) => (
            <FeedCard key={f.uri} feed={f} savedState={lookup?.get(f.uri)} />
          ))}
          {discover.hasNextPage && (
            <button
              className="feeds__more"
              onClick={() => discover.fetchNextPage()}
              disabled={discover.isFetchingNextPage}
            >
              {discover.isFetchingNextPage ? <Spinner size="sm" /> : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
