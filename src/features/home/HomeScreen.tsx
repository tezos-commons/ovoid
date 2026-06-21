import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { ErrorState, Spinner, IconButton } from '@/components'
import { PageAside, MobileTopLeft, MobileTopRight, MobileSelect } from '@/components/layout'
import { GearIcon, BskyIcon } from '@/components/Icon'
import { useAuth, useAgent } from '@/lib/api/agent'
import { useDragScroll } from '@/lib/use-drag-scroll'
import { useIsMobile } from '@/lib/use-is-mobile'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { runWhenIdle } from '@/lib/idle'
import { FeedView } from './FeedView'
import { FeedRefreshButton } from './FeedRefreshButton'
import { usePinnedFeeds, type HomeTab } from './use-pinned-feeds'
import { useTimeline, timelineOptions } from './use-timeline'
import { useCustomFeed, customFeedOptions } from './use-custom-feed'
import { useFeedRefresh } from './use-feed-refresh'
import './home.css'

/** Newest post uri on screen for a feed query's cached pages. */
function topUriOf(data: unknown): string | undefined {
  const pages = (data as { pages?: { feed?: { post?: { uri?: string } }[] }[] } | undefined)?.pages
  return pages?.[0]?.feed?.[0]?.post?.uri
}

const FOLLOWING_KEY = 'following'

// Remember the selected feed tab across HomeScreen unmount/remount (opening a
// post and sliding back remounts the screen). Without this, activeKey re-inits to
// Following, so you return to a DIFFERENT feed — which also remounts a possibly
// cold feed query: blank → load → scroll lost. Stored in sessionStorage (not a
// module variable) so it ALSO survives a full page reload — mobile/iOS-standalone
// sometimes reloads the document on back, which would wipe an in-memory value.
const TAB_STORAGE_KEY = 'ovoid:home-feed-tab'
function loadLastTab(): string {
  try {
    return sessionStorage.getItem(TAB_STORAGE_KEY) || FOLLOWING_KEY
  } catch {
    return FOLLOWING_KEY
  }
}

/**
 * Home timeline screen.
 *
 * The pinned feeds ("Following" + custom feeds/lists) render as a vertical menu
 * in the page aside (left column); there is no top header. The feed itself is a
 * flex column pinned to the viewport height: the feed region takes the full
 * height as the scroll container the InfiniteList virtualizes over (InfiniteList
 * is height:100%/overflow:auto, so its parent MUST be bounded — that region does
 * not document-scroll). Composing is launched from the top bar's New Post.
 *
 * Exactly one feed query is active at a time: useTimeline and useCustomFeed are
 * both mounted (hooks can't be conditional) but each is `enabled` only for the
 * matching active tab, so only one network read runs.
 */
export function HomeScreen() {
  const { isAuthed } = useAuth()
  const { agent, did } = useAgent()
  const navigate = useNavigate()
  const pinned = usePinnedFeeds()
  const tabs: HomeTab[] = pinned.data ?? [
    { key: FOLLOWING_KEY, label: 'Following', kind: 'following', value: 'following', id: 'timeline', pinned: true },
  ]

  const [activeKey, setActiveKey] = useState(loadLastTab)
  const activeTab = useMemo(
    () => tabs.find((t) => t.key === activeKey) ?? tabs[0],
    [tabs, activeKey],
  )

  // Persist the selection so a remount or reload (post → back) restores the same tab.
  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, activeKey)
    } catch {
      /* private mode / storage disabled — fall back to in-session default */
    }
  }, [activeKey])

  // If the active key vanishes (prefs changed), fall back to Following — but only
  // once pinned feeds have loaded. While loading, `tabs` is just the default
  // [Following], which would spuriously reset a restored custom-feed key.
  useEffect(() => {
    if (pinned.data && !tabs.some((t) => t.key === activeKey)) setActiveKey(FOLLOWING_KEY)
  }, [pinned.data, tabs, activeKey])

  // Keep every INACTIVE pinned feed fresh in the background — initially (instant
  // tab switch) and on a periodic timer (new posts land without the user asking).
  // The ACTIVE feed is excluded: it never auto-refetches under the user (that
  // would reflow + lose scroll); it surfaces a refresh badge instead (below).
  // prefetchInfiniteQuery refetches a stale entry and bypasses refetchOnMount.
  useEffect(() => {
    if (!isAuthed) return
    const refreshInactive = () => {
      for (const t of tabs) {
        if (t.key === activeKey || !t.value) continue
        const opts =
          t.kind === 'following'
            ? timelineOptions(agent, did)
            : customFeedOptions(agent, did, t.value, t.kind === 'list' ? 'list' : 'feed')
        schedulePrefetch(opts.queryKey, () =>
          queryClient.prefetchInfiniteQuery(
            opts as Parameters<typeof queryClient.prefetchInfiniteQuery>[0],
          ),
        )
      }
    }
    const cancelIdle = runWhenIdle(refreshInactive)
    const id = window.setInterval(refreshInactive, 90_000)
    return () => {
      cancelIdle?.()
      window.clearInterval(id)
    }
  }, [tabs, agent, did, isAuthed, activeKey])

  const isFollowing = activeTab?.kind === 'following'
  const timeline = useTimeline(isAuthed && isFollowing)
  const customFeed = useCustomFeed(
    activeTab?.value,
    activeTab?.kind === 'list' ? 'list' : 'feed',
    isAuthed && !isFollowing && !!activeTab,
  )

  const active = isFollowing ? timeline : customFeed

  // Refresh affordance for the active feed: detect a newer head (cache >1min old)
  // and reload-to-top on tap. Never auto-refetches the visible feed.
  const { hasNew, refresh } = useFeedRefresh({
    agent,
    did,
    tab: activeTab,
    enabled: isAuthed && !!active.data,
    visibleTopUri: topUriOf(active.data),
    dataUpdatedAt: active.dataUpdatedAt,
  })

  const navRef = useDragScroll<HTMLElement>()
  const isMobile = useIsMobile()

  const feedNav = (
    <nav ref={navRef} className="feednav" aria-label="Feeds">
      <div className="feednav__head">
        <span className="feednav__title">Feeds</span>
        <IconButton label="Edit feeds" onClick={() => navigate('/feeds')}>
          <GearIcon size={18} />
        </IconButton>
      </div>
      {pinned.isLoading ? (
        <div className="feednav__loading">
          <Spinner size="sm" />
        </div>
      ) : (
        tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={clsx('feednav__item', t.key === activeKey && 'feednav__item--active')}
            aria-current={t.key === activeKey ? 'page' : undefined}
            onClick={() => setActiveKey(t.key)}
          >
            {t.label}
          </button>
        ))
      )}
    </nav>
  )

  // Mobile chrome: the feed selector + settings live in the floating top bar, and
  // a compose entry pill in the bottom bar. The inline feed strip is dropped.
  const mobileChrome = isMobile && (
    <>
      <MobileTopLeft>
        <IconButton label="Edit feeds" onClick={() => navigate('/feeds')}>
          <GearIcon size={20} />
        </IconButton>
      </MobileTopLeft>
      <MobileTopRight>
        <MobileSelect
          ariaLabel="Select feed"
          label={activeTab?.label ?? 'Following'}
          items={[
            ...tabs.map((t) => ({
              key: t.key,
              label: t.label,
              icon: <BskyIcon size={16} />,
              onSelect: () => setActiveKey(t.key),
            })),
          ]}
        />
      </MobileTopRight>
    </>
  )

  return (
    <>
      {/* Desktop: feed menu in the aside. Mobile: feed selection moves to the
          floating top bar (see mobileChrome). */}
      <PageAside>{!isMobile && feedNav}</PageAside>
      {mobileChrome}

      <div className="home">
        <div className="home__feed">
          {pinned.isError ? (
            <ErrorState error={pinned.error} onRetry={() => void pinned.refetch()} />
          ) : (
            <FeedView
              // Remount the feed list when the tab changes so scroll/virtual state
              // resets cleanly to the top of the newly-selected feed.
              key={activeTab?.key ?? FOLLOWING_KEY}
              query={active as never}
              scrollKey={`home:${activeTab?.key ?? FOLLOWING_KEY}`}
              emptyMessage={
                isFollowing
                  ? 'Follow people to see their posts here.'
                  : 'This feed has no posts right now.'
              }
            />
          )}
        </div>
      </div>

      <FeedRefreshButton show={hasNew} onRefresh={refresh} isMobile={isMobile} />
    </>
  )
}

export default HomeScreen
