import clsx from 'clsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface MenuItem {
  key: string
  label: ReactNode
  onSelect: () => void
  danger?: boolean
  /** Shown above the label in the grid variant. */
  icon?: ReactNode
  /** Highlight this item as the current selection (grid variant). */
  active?: boolean
}

export interface MenuProps {
  trigger: ReactNode
  items: MenuItem[]
  /** 'grid' lays items out as an icon grid (3 per row); default is a list. */
  variant?: 'list' | 'grid'
  /**
   * Horizontal anchor of the popover to its trigger. 'end' (default) right-aligns
   * it — correct for triggers near the right edge (overflow "…" buttons). 'start'
   * left-aligns it under the trigger — for triggers mid-row (e.g. the repost
   * button) where a right-aligned panel would extend left and run off-screen.
   */
  align?: 'start' | 'end'
}

/** Dropdown for the post/profile overflow menus. Closes on outside click, Escape, or selection. */
export function Menu({ trigger, items, variant = 'list', align = 'end' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu__wrap" ref={wrapRef}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div
          className={clsx(
            'menu__pop',
            variant === 'grid' && 'menu__pop--grid',
            align === 'start' && 'menu__pop--start',
          )}
          role="menu"
        >
          {items.map((item) =>
            variant === 'grid' ? (
              <button
                key={item.key}
                role="menuitem"
                className={clsx('menu__griditem', item.active && 'menu__griditem--active')}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                <span className="menu__gridicon">{item.icon}</span>
                <span className="menu__gridlabel">{item.label}</span>
              </button>
            ) : (
              <button
                key={item.key}
                role="menuitem"
                aria-current={item.active || undefined}
                className={clsx(
                  'menu__item',
                  item.danger && 'menu__item--danger',
                  item.active && 'menu__item--active',
                )}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.icon != null && <span className="menu__itemicon">{item.icon}</span>}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
