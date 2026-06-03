import { useState } from 'react'
import clsx from 'clsx'
import { ScreenHeader, PageAside } from '@/components/layout'
import { type TabItem } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useDragScroll } from '@/lib/use-drag-scroll'
import { useIsMobile } from '@/lib/use-is-mobile'
import { MyFeedsTab } from './MyFeedsTab'
import { DiscoverTab } from './DiscoverTab'
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
  const { isAuthed } = useAgent()
  const [tab, setTab] = useState<TabKey>(isAuthed ? 'mine' : 'discover')
  const navRef = useDragScroll<HTMLElement>()
  const isMobile = useIsMobile()

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
      {/* Desktop: menu in the aside. Mobile: into the main column (sticky) so it
          shares the feed's scroll container. */}
      <PageAside>{!isMobile && feedsNav}</PageAside>

      <ScreenHeader title="Feeds" />

      {isMobile && feedsNav}

      <div className="feeds">
        {tab === 'mine' ? <MyFeedsTab authed={isAuthed} /> : <DiscoverTab />}
      </div>
    </>
  )
}
