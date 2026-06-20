import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigationType } from 'react-router-dom'
import { useWindowVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'
import { Spinner } from './Spinner'
import { useFadeTopBarOnScroll } from './layout/mobile/MobileChrome'
import { getSavedWindowScroll, useWindowScrollRestoration } from '@/lib/scroll-restoration'
import { isOverlayOpen, isTypingTarget } from '@/lib/keyboard'

export interface InfiniteListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  getKey: (item: T) => string
  estimateSize?: number
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => void
  /** Count of fresh items waiting above the fold (drives the "new posts" pill). */
  newItemsCount?: number
  onNewItems?: () => void
  emptyState?: ReactNode
  /**
   * Stable id for this list's scroll position. When set, the scroll offset AND
   * the measured row heights are remembered across unmount/remount (e.g. opening
   * a post and pressing back), so the list restores to the exact same place.
   * Omit for lists where restoration isn't wanted.
   */
  scrollKey?: string
  /**
   * Enable the desktop keyboard cursor: j/k move a highlighted row, o/Enter open
   * it, l likes, r replies. Actions dispatch to the focused row's existing
   * controls (`.postcard` click, `.action--like`/`.action--reply`), so they
   * degrade to no-ops on non-post rows. Default on.
   */
  cursorNav?: boolean
  /**
   * Mobile only: fade the floating top bar out while scrolling down and back in
   * while scrolling up. Opt-in (feeds), so surfaces whose top bar holds an input
   * — e.g. search — keep it visible.
   */
  fadeTopBarOnScroll?: boolean
}

/**
 * Remembered row-measurement cache, keyed by `scrollKey`. The scroll OFFSET is
 * restored via useWindowScrollRestoration; persisting the measurement cache
 * alongside it is what makes restoration exact — a fresh virtualizer would
 * re-estimate every row and the same offset would land at a different logical
 * position. Module-level so it survives unmount; page-session lifetime only.
 */
const measurementsMemory = new Map<string, VirtualItem[]>()

/**
 * Virtualized infinite list, virtualized against the WINDOW (document) scroll —
 * the same model as ProfileFeed. The document is the sole scroller: this keeps
 * the DOM bounded however deep the user pages, and (unlike an internal
 * overflow:auto container) lets content rise into the iOS safe-area / camera
 * island, which only happens for the document scroller.
 *
 * Invariant: the virtualizer's item count == items.length; the loading row is
 * rendered outside the virtual window so it never shifts measured offsets.
 * fetchNextPage fires when the last virtual item is within one viewport.
 */
export function InfiniteList<T>({
  items,
  renderItem,
  getKey,
  estimateSize = 120,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
  newItemsCount = 0,
  onNewItems,
  emptyState,
  scrollKey,
  cursorNav = true,
  fadeTopBarOnScroll = false,
}: InfiniteListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  // The list's start offset from the document top, fed to the virtualizer so it
  // maps window scrollY → item space. getBoundingClientRect().top + scrollY is
  // the true document offset and (unlike offsetTop) is correct regardless of any
  // positioned ancestor (.home__feed etc. are position:relative). Scroll-
  // invariant, so it only changes when chrome above the list resizes.
  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      const el = listRef.current
      if (el) setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const isPop = useNavigationType() === 'POP'
  // Window-scrolled: restore the document scroll offset across unmount/remount.
  useWindowScrollRestoration(scrollKey)
  // Mobile: fade the top bar out on scroll-down / in on scroll-up (opt-in). No
  // ref → tracks the window scroll, which is now the list's scroller.
  useFadeTopBarOnScroll(undefined, fadeTopBarOnScroll)

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan: 6,
    scrollMargin,
    getItemKey: (index) => getKey(items[index]),
    // Seed the SAME offset useWindowScrollRestoration applies: 0 on forward
    // navigation, the saved offset on POP. The library default is the CURRENT
    // window.scrollY — at construction still the PREVIOUS screen's depth — whose
    // scroll-anchoring would yank the window back after our reset.
    initialOffset: isPop ? getSavedWindowScroll(scrollKey) ?? 0 : 0,
    // Measurements are positions from a previous visit, valid only with the
    // restored offset; seeding them on a fresh (top) entry corrupts row deltas.
    initialMeasurementsCache:
      isPop && scrollKey ? measurementsMemory.get(scrollKey) : undefined,
  })

  // Persist measured heights at unmount so back-navigation restores exactly.
  useEffect(() => {
    if (!scrollKey) return
    return () => {
      measurementsMemory.set(scrollKey, virtualizer.measurementsCache)
    }
  }, [scrollKey, virtualizer])

  const virtualItems = virtualizer.getVirtualItems()

  // Desktop keyboard cursor. Lives here, next to the virtualizer, so moving the
  // cursor can scroll an off-screen target into view (rendering it) before acting
  // on it. The highlight is a class on the row whose index matches; actions are
  // dispatched to that row's existing controls so they no-op on non-post rows.
  const [cursor, setCursor] = useState<number | null>(null)
  useEffect(() => {
    if (!cursorNav) return
    const max = items.length - 1

    const act = (kind: 'open' | 'like' | 'reply') => {
      if (cursor == null || cursor > max) return
      const run = (row: Element | null | undefined) => {
        if (!row) return
        if (kind === 'open') {
          const cards = row.querySelectorAll<HTMLElement>('.postcard')
          ;(cards[cards.length - 1] ?? row.querySelector<HTMLElement>('a'))?.click()
        } else {
          row
            .querySelector<HTMLElement>(kind === 'like' ? '.action--like' : '.action--reply')
            ?.click()
        }
      }
      const row = listRef.current?.querySelector('.inflist__row--cursor')
      if (row) return run(row)
      // Cursor scrolled out of the rendered window: bring it back, then act.
      virtualizer.scrollToIndex(cursor, { align: 'center' })
      requestAnimationFrame(() => run(listRef.current?.querySelector('.inflist__row--cursor')))
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(document.activeElement) || isOverlayOpen()) return
      if (max < 0) return
      const ae = document.activeElement
      const onControl =
        ae instanceof HTMLElement && (ae.tagName === 'BUTTON' || ae.tagName === 'A')
      switch (e.key) {
        case 'j':
          e.preventDefault()
          setCursor((c) => {
            const n = c == null ? 0 : Math.min(c + 1, max)
            virtualizer.scrollToIndex(n, { align: 'auto' })
            return n
          })
          break
        case 'k':
          e.preventDefault()
          setCursor((c) => {
            const n = c == null ? 0 : Math.max(c - 1, 0)
            virtualizer.scrollToIndex(n, { align: 'auto' })
            return n
          })
          break
        case 'o':
          e.preventDefault()
          act('open')
          break
        case 'Enter':
          // Leave Enter to a focused button/link if the user tabbed to one.
          if (!onControl) {
            e.preventDefault()
            act('open')
          }
          break
        case 'l':
          e.preventDefault()
          act('like')
          break
        case 'r':
          e.preventDefault()
          act('reply')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cursorNav, items.length, virtualizer, cursor])

  // Tapping the "new posts" pill refetches (prepending the fresh items) and
  // scrolls the feed back to the very top so they're in view.
  const handleNewItems = () => {
    onNewItems?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Prefetch the next page when the tail comes into view.
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1]
    if (!last) return
    if (last.index >= items.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage?.()
    }
  }, [virtualItems, items.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className="inflist" ref={listRef}>
      {newItemsCount > 0 && (
        <button className="inflist__newpill" onClick={handleNewItems}>
          {newItemsCount} new {newItemsCount === 1 ? 'post' : 'posts'}
        </button>
      )}

      <div className="inflist__inner" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((vi) => (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            className={clsx('inflist__row', cursorNav && cursor === vi.index && 'inflist__row--cursor')}
            style={{ transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)` }}
          >
            {renderItem(items[vi.index], vi.index)}
          </div>
        ))}
      </div>

      {isFetchingNextPage && (
        <div className="inflist__footer">
          <Spinner />
        </div>
      )}
    </div>
  )
}
