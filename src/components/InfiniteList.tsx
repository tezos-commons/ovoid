import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { Spinner } from './Spinner'

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
            className="inflist__row"
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
