import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'
import { Spinner } from './Spinner'
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
}

/**
 * Remembered scroll state, keyed by `scrollKey`. Persisting the measurement
 * cache (not just the px offset) is what makes restoration exact: a fresh
 * virtualizer would otherwise re-estimate every row and the offset would land at
 * a different logical position. Module-level so it survives the component's
 * unmount; lives for the page session only (never serialized).
 */
type SavedScroll = { offset: number; measurements: VirtualItem[] }
const scrollMemory = new Map<string, SavedScroll>()

/**
 * Virtualized infinite list. Uses the window/document scroll via a measured
 * container; rows are dynamically measured so variable-height posts work.
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
}: InfiniteListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const restore = scrollKey ? scrollMemory.get(scrollKey) : undefined

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 6,
    getItemKey: (index) => getKey(items[index]),
    // Seed from saved state so the first paint already renders the correct
    // window at the right total height (no flash before the effect runs).
    initialOffset: restore?.offset,
    initialMeasurementsCache: restore?.measurements,
  })

  // Apply the saved offset to the actual scroll element on mount. initialOffset
  // only seeds the virtualizer's math; the DOM element still starts at 0.
  useLayoutEffect(() => {
    if (restore && parentRef.current) parentRef.current.scrollTop = restore.offset
    // Mount-only: re-running on restore changes would fight the user's scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist offset + measured heights on scroll and at unmount.
  useEffect(() => {
    const el = parentRef.current
    if (!el || !scrollKey) return
    const save = () => {
      scrollMemory.set(scrollKey, {
        offset: el.scrollTop,
        measurements: virtualizer.measurementsCache,
      })
    }
    el.addEventListener('scroll', save, { passive: true })
    return () => {
      save()
      el.removeEventListener('scroll', save)
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
      const row = parentRef.current?.querySelector('.inflist__row--cursor')
      if (row) return run(row)
      // Cursor scrolled out of the rendered window: bring it back, then act.
      virtualizer.scrollToIndex(cursor, { align: 'center' })
      requestAnimationFrame(() => run(parentRef.current?.querySelector('.inflist__row--cursor')))
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
    parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
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
    <div className="inflist" ref={parentRef}>
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
            style={{ transform: `translateY(${vi.start}px)` }}
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
