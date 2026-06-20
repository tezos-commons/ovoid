import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { tezosEntityPath } from '@/features/contract/contract-route'
import { Tabs, Icons, type TabItem, type MenuItem } from '@/components'
import { MobileTopBarFill, MobileSelect, useFadeTopBarOnScroll } from '@/components/layout'
import { useIsMobile } from '@/lib/use-is-mobile'
import './search.css'
import { TypeaheadDropdown } from './TypeaheadDropdown'
import { DiscoverState } from './DiscoverState'
import { PostResults, PeopleResults, FeedResults } from './SearchResults'
import type { PostSort } from './use-search-posts'

type TabKey = 'top' | 'latest' | 'people' | 'feeds'

const TABS: TabItem[] = [
  { key: 'top', label: 'Top' },
  { key: 'latest', label: 'Latest' },
  { key: 'people', label: 'People' },
  { key: 'feeds', label: 'Feeds' },
]

function parseTab(raw: string | null): TabKey {
  return raw === 'latest' || raw === 'people' || raw === 'feeds' ? raw : 'top'
}

/**
 * Search route entry. The URL (?q, ?tab) is the single source of truth for the
 * committed query so trending-topic links, deep links and reloads all restore
 * state; the input holds a transient draft that commits to the URL on submit.
 *
 * Public-capable: every hook here reads through useAgent(), which yields the
 * public AppView agent when signed out — searchPosts/searchActors/typeahead all
 * serve unauthenticated (viewer state is simply absent).
 */
export default function SearchScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const committed = params.get('q')?.trim() ?? ''
  const tab = parseTab(params.get('tab'))

  const [draft, setDraft] = useState(committed)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // Fade the top bar (the search input) on scroll once results are showing. The
  // Posts/People tabs scroll inside their own InfiniteList (handled there); this
  // covers the document-flow Feeds tab, which scrolls .search__content itself.
  useFadeTopBarOnScroll(contentRef, !!committed)

  // Keep the input in sync when the committed query changes externally
  // (e.g. navigating in via a trending chip / browser back-forward).
  useEffect(() => {
    setDraft(committed)
  }, [committed])

  // Close the typeahead on outside click.
  useEffect(() => {
    if (!focused) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [focused])

  const commit = (q: string, nextTab: TabKey = tab) => {
    const trimmed = q.trim()
    setFocused(false)
    inputRef.current?.blur()
    if (!trimmed) {
      setParams({}, { replace: false })
      return
    }
    // A Tezos contract/account address isn't a text search — route to its view.
    const dest = tezosEntityPath(trimmed)
    if (dest) {
      navigate(dest)
      return
    }
    setParams({ q: trimmed, tab: nextTab })
  }

  const setTab = (key: string) => {
    const next = parseTab(key)
    if (committed) setParams({ q: committed, tab: next })
    // No committed query: tab is irrelevant; discover state is shown regardless.
  }

  const clear = () => {
    setDraft('')
    setParams({})
    inputRef.current?.focus()
  }

  // Typeahead shows while the box is focused and the draft is non-empty;
  // once focus leaves or a result is picked it hides.
  const showTypeahead = focused && draft.trim().length > 0
  const isMobile = useIsMobile()

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0]
  const tabMenuItems: MenuItem[] = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    active: t.key === tab,
    onSelect: () => setTab(t.key),
  }))

  // The search field. On mobile it becomes the whole top bar; on desktop it's the
  // in-page header band.
  const searchBox = (
    <div className="search__box" ref={boxRef}>
      <Icons.SearchIcon size={18} className="search__box-icon" />
      <input
        ref={inputRef}
        className="search__input"
        type="search"
        placeholder="Search posts, people and feeds"
        value={draft}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(draft)
          } else if (e.key === 'Escape') {
            setFocused(false)
            inputRef.current?.blur()
          }
        }}
      />
      {draft && (
        <button className="search__clear" onClick={clear} aria-label="Clear search">
          <Icons.CloseIcon size={16} />
        </button>
      )}

      {showTypeahead && (
        <TypeaheadDropdown
          query={draft}
          onSubmitSearch={() => commit(draft)}
          onPick={() => setFocused(false)}
        />
      )}
    </div>
  )

  return (
    <>
      {isMobile && (
        <MobileTopBarFill>
          <div className="search__mobilebar">
            {searchBox}
            {/* Tabs don't fit a phone-width bar — fold them into the shared
                top-bar dropdown (same as Home's feed selector), shown only once a
                query is committed. */}
            {committed && (
              <MobileSelect ariaLabel="Result type" label={activeTab.label} items={tabMenuItems} />
            )}
          </div>
        </MobileTopBarFill>
      )}

      <div className="search">
      {/* Desktop: the in-page header holds the search box + result tabs. On mobile
          the box and tab dropdown live in the floating top bar instead. */}
      {!isMobile && (
        <header className="search__header">
          {searchBox}
          {committed && <Tabs items={TABS} activeKey={tab} onChange={setTab} sticky />}
        </header>
      )}

      <div className="search__content" ref={contentRef}>
        {!committed ? (
          <DiscoverState />
        ) : tab === 'people' ? (
          <PeopleResults q={committed} />
        ) : tab === 'feeds' ? (
          <FeedResults q={committed} />
        ) : (
          <PostResults q={committed} sort={tab as PostSort} />
        )}
      </div>
      </div>
    </>
  )
}
