import { EmptyState, ErrorState, Icons } from '@/components'
import { FeedCard } from './FeedCard'
import { useMyFeeds } from './use-my-feeds'
import { useSavedFeedsState } from './use-feed-prefs'
import { SectionHeader, FeedListSkeleton } from './FeedSection'

/**
 * My Feeds tab: the viewer's pinned + saved generators (savedFeedsPrefV2),
 * hydrated to full views, each with live pin/save toggles. Empty/guarded when
 * signed out since saved feeds are viewer state.
 */
export function MyFeedsTab({ authed }: { authed: boolean }) {
  const my = useMyFeeds()
  const saved = useSavedFeedsState()

  if (!authed) {
    return (
      <EmptyState
        icon={<Icons.HashIcon size={32} />}
        title="Sign in to manage feeds"
        message="Pinned and saved feeds live in your account preferences."
      />
    )
  }

  if (my.isLoading) return <FeedListSkeleton />
  if (my.isError) {
    return <ErrorState error={my.error} onRetry={() => my.refetch()} />
  }

  const data = my.data
  if (!data || data.all.length === 0) {
    return (
      <EmptyState
        icon={<Icons.HashIcon size={32} />}
        title="No saved feeds yet"
        message="Find feeds in Discover and pin them here for quick access."
      />
    )
  }

  const lookup = saved.data?.byValue

  return (
    <div className="feeds__list">
      {data.pinned.length > 0 && (
        <>
          <SectionHeader
            icon={<Icons.HashIcon size={16} />}
            label="Pinned"
            hint="Shown as tabs on Home"
          />
          {data.pinned.map((f) => (
            <FeedCard key={f.uri} feed={f} savedState={lookup?.get(f.uri)} />
          ))}
        </>
      )}

      {data.saved.length > 0 && (
        <>
          <SectionHeader icon={<Icons.BookmarkIcon size={16} />} label="Saved" />
          {data.saved.map((f) => (
            <FeedCard key={f.uri} feed={f} savedState={lookup?.get(f.uri)} />
          ))}
        </>
      )}
    </div>
  )
}
