import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import type { AppBskyFeedDefs } from '@atproto/api'
import { ErrorState, Spinner, IconButton } from '@/components'
import { PageAside } from '@/components/layout'
import { GearIcon } from '@/components/Icon'
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
import { useNewPosts } from './use-new-posts'
import './home.css'

const FOLLOWING_KEY = 'following'

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

  const [activeKey, setActiveKey] = useState(FOLLOWING_KEY)
  const activeTab = useMemo(
    () => tabs.find((t) => t.key === activeKey) ?? tabs[0],
    [tabs, activeKey],
  )

  // If the active key vanishes (prefs changed), fall back to Following.
  useEffect(() => {
    if (!tabs.some((t) => t.key === activeKey)) setActiveKey(FOLLOWING_KEY)
  }, [tabs, activeKey])

  // Preload every pinned feed's first page once the strip is known, so clicking
  // a feed name renders instantly instead of cold-fetching. Only the active tab
  // is `enabled`, so without this each switch starts from an empty cache. Idle +
  // concurrency-bounded so it never delays the active feed's first paint.
  useEffect(() => {
    if (!isAuthed) return
    const feeds = tabs.filter((t) => t.kind !== 'following' && t.value)
    if (feeds.length === 0) return
    return runWhenIdle(() => {
      for (const t of feeds) {
        const opts = customFeedOptions(agent, did, t.value, t.kind === 'list' ? 'list' : 'feed')
        schedulePrefetch(opts.queryKey, () => queryClient.prefetchInfiniteQuery(opts))
      }
    })
  }, [tabs, agent, did, isAuthed])

  const isFollowing = activeTab?.kind === 'following'
  const timeline = useTimeline(isAuthed && isFollowing)
  const customFeed = useCustomFeed(
    activeTab?.value,
    activeTab?.kind === 'list' ? 'list' : 'feed',
    isAuthed && !isFollowing && !!activeTab,
  )

  const active = isFollowing ? timeline : customFeed

  // Top rendered post uri drives new-post detection.
  const topUri: string | undefined = (() => {
    const pages = active.data?.pages as { feed: AppBskyFeedDefs.FeedViewPost[] }[] | undefined
    return pages?.[0]?.feed?.[0]?.post.uri
  })()

  const { newItemsCount, reset } = useNewPosts(activeTab, topUri, isAuthed)

  const onNewItems = () => {
    reset()
    void active.refetch()
  }

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

  return (
    <>
      {/* Desktop: menu in the aside. Mobile: into .home (the internally-scrolled
          flex column) as the first row, so it stays fixed above the feed. */}
      <PageAside>{!isMobile && feedNav}</PageAside>

      <div className="home">
        {isMobile && feedNav}

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
              newItemsCount={newItemsCount}
              onNewItems={onNewItems}
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
