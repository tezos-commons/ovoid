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
import { usePinnedFeeds, type HomeTab } from './use-pinned-feeds'
import { useTimeline } from './use-timeline'
import { useCustomFeed, customFeedOptions } from './use-custom-feed'
import './home.css'

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

  // Preload every INACTIVE pinned feed's first page once the strip is known, so
  // clicking a feed name renders instantly instead of cold-fetching. The active
  // tab is excluded: prefetchInfiniteQuery ignores refetchOnMount and would
  // refetch the feed you're currently viewing once it's stale — reflowing it and
  // losing scroll (the "feed refreshes on its own"). Idle + concurrency-bounded.
  useEffect(() => {
    if (!isAuthed) return
    const feeds = tabs.filter((t) => t.kind !== 'following' && t.value && t.key !== activeKey)
    if (feeds.length === 0) return
    return runWhenIdle(() => {
      for (const t of feeds) {
        const opts = customFeedOptions(agent, did, t.value, t.kind === 'list' ? 'list' : 'feed')
        schedulePrefetch(opts.queryKey, () => queryClient.prefetchInfiniteQuery(opts))
      }
    })
  }, [tabs, agent, did, isAuthed, activeKey])

  const isFollowing = activeTab?.kind === 'following'
  const timeline = useTimeline(isAuthed && isFollowing)
  const customFeed = useCustomFeed(
    activeTab?.value,
    activeTab?.kind === 'list' ? 'list' : 'feed',
    isAuthed && !isFollowing && !!activeTab,
  )

  const active = isFollowing ? timeline : customFeed

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
    </>
  )
}

export default HomeScreen
