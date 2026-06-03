import clsx from 'clsx'
import type { TabItem } from '@/components'
import { useDragScroll } from '@/lib/use-drag-scroll'

export interface ProfileNavProps {
  items: TabItem[]
  activeKey: string
  onChange: (key: string) => void
}

/**
 * Profile section menu (Posts / Replies / Media / …). A vertical list in the page
 * aside on desktop; on phone widths it lays out as a horizontal, drag-scrollable
 * tab strip (see the @media block in profile.css + useDragScroll). Drives the
 * same `?tab=` selection state owned by ProfileScreen.
 */
export function ProfileNav({ items, activeKey, onChange }: ProfileNavProps) {
  const dragRef = useDragScroll<HTMLElement>()
  return (
    <nav ref={dragRef} className="profnav" aria-label="Profile sections">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          className={clsx('profnav__item', t.key === activeKey && 'profnav__item--active')}
          aria-current={t.key === activeKey ? 'page' : undefined}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
