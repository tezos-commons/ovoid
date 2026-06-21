import { RefreshIcon } from '@/components/Icon'

/**
 * "New posts available" affordance for the active feed. We never auto-refresh a
 * cached feed under the user; instead, when a newer head is detected (and the
 * cache is >1min old) this appears. Tapping reloads the feed and scrolls to top.
 *
 * Desktop: a pill centered at the top of the feed. Mobile: a round liquid-glass
 * button bottom-right, above the floating bottom bar.
 */
export function FeedRefreshButton({
  show,
  onRefresh,
  isMobile,
}: {
  show: boolean
  onRefresh: () => void
  isMobile: boolean
}) {
  if (!show) return null

  if (isMobile) {
    return (
      <button
        type="button"
        className="feed-refresh feed-refresh--mobile liquid-glass"
        onClick={onRefresh}
        aria-label="Load new posts"
      >
        <span className="liquid-glass__layer" aria-hidden="true" />
        <RefreshIcon size={22} />
      </button>
    )
  }

  return (
    <button type="button" className="feed-refresh feed-refresh--desktop" onClick={onRefresh}>
      <RefreshIcon size={15} />
      New posts
    </button>
  )
}
