import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { ScreenHeader, PageAside, MobileTopRight, MobileSelect, useMobileTitle } from '@/components/layout'
import { type TabItem } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { runWhenIdle } from '@/lib/idle'
import { useDragScroll } from '@/lib/use-drag-scroll'
import { useIsMobile } from '@/lib/use-is-mobile'
import { MyFeedsTab } from './MyFeedsTab'
import { DiscoverTab } from './DiscoverTab'
import { myFeedsOptions } from './use-my-feeds'
import { discoverFeedsOptions, suggestedFeedsOptions } from './use-discover-feeds'
import './feeds.css'

type TabKey = 'mine' | 'discover'

const TABS: TabItem[] = [
  { key: 'mine', label: 'My Feeds' },
  { key: 'discover', label: 'Discover' },
]

/**
 * /feeds — feed discovery + management.
 *
 * Two sub-tabs:
 *  - My Feeds: the viewer's pinned + saved generators (savedFeedsPrefV2),
 *    hydrated to full views, each with live pin/save toggles.
 *  - Discover: personalized suggestions (getSuggestedFeeds) + popular
 *    generators (unspecced.getPopularFeedGenerators), searchable, paginated.
 *
 * Protected route, but every read still flows through useAgent(); the My Feeds
 * tab is empty/guarded when signed out since saved feeds are viewer state.
 */
export default function FeedsScreen() {
  const { agent, did, isAuthed } = useAgent()
  const [tab, setTab] = useState<TabKey>(isAuthed ? 'mine' : 'discover')
  const navRef = useDragScroll<HTMLElement>()
  const isMobile = useIsMobile()
  useMobileTitle(isMobile ? 'Feeds' : null)

  // Warm the inactive sibling tab on idle (My Feeds is also nav-warmed; the
  // dedupe in schedulePrefetch makes the overlap free).
  useEffect(() => {
    return runWhenIdle(() => {
      const discover = discoverFeedsOptions(agent, '')
      schedulePrefetch(discover.queryKey, () =>
        queryClient.prefetchInfiniteQuery(
          discover as Parameters<typeof queryClient.prefetchInfiniteQuery>[0],
        ),
      )
      if (isAuthed) {
        const suggested = suggestedFeedsOptions(agent, did)
        schedulePrefetch(suggested.queryKey, () => queryClient.prefetchQuery(suggested))
        const mine = myFeedsOptions(agent, did)
        schedulePrefetch(mine.queryKey, () => queryClient.prefetchQuery(mine))
      }
    })
  }, [agent, did, isAuthed])

  const feedsNav = (
    <nav ref={navRef} className="feedsnav" aria-label="Feeds">
      <div className="feedsnav__head">
        <span className="feedsnav__title">Feeds</span>
      </div>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={clsx('feedsnav__item', t.key === tab && 'feedsnav__item--active')}
          aria-current={t.key === tab ? 'page' : undefined}
          onClick={() => setTab(t.key as TabKey)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )

  return (
    <>
      {/* Desktop: menu in the aside. Mobile: My Feeds / Discover folds into a
          top-bar dropdown. */}
      <PageAside>{!isMobile && feedsNav}</PageAside>
      {isMobile && (
        <MobileTopRight>
          <MobileSelect
            ariaLabel="Feed section"
            label={TABS.find((t) => t.key === tab)?.label ?? 'My Feeds'}
            items={TABS.map((t) => ({
              key: t.key,
              label: t.label,
              onSelect: () => setTab(t.key as TabKey),
            }))}
          />
        </MobileTopRight>
      )}

      <ScreenHeader title="Feeds" />

      <div className="feeds">
        {tab === 'mine' ? <MyFeedsTab authed={isAuthed} /> : <DiscoverTab />}
      </div>
    </>
  )
}
