import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, Icons, type TabItem } from '@/components'
import { MobileTopBarFill } from '@/components/layout'
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
  const [params, setParams] = useSearchParams()
  const committed = params.get('q')?.trim() ?? ''
  const tab = parseTab(params.get('tab'))

  const [draft, setDraft] = useState(committed)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

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
      {isMobile && <MobileTopBarFill>{searchBox}</MobileTopBarFill>}

      <div className="search">
      {/* Mobile: the search box is the top bar; the header keeps only the result
          tabs (and only when there's a committed query). */}
      {(!isMobile || committed) && (
        <header className="search__header">
          {!isMobile && searchBox}
          {committed && <Tabs items={TABS} activeKey={tab} onChange={setTab} sticky />}
        </header>
      )}

      <div className="search__content">
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
