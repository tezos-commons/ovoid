import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'

export interface TabItem {
  key: string
  label: string
  /** When set, the tab renders as a router Link instead of a button. */
  to?: string
}

export interface TabsProps {
  items: TabItem[]
  activeKey: string
  onChange?: (key: string) => void
  sticky?: boolean
}

export function Tabs({ items, activeKey, onChange, sticky = false }: TabsProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Translate vertical wheel into horizontal scroll when the strip overflows.
  // A native, non-passive listener is required: React registers onWheel as a
  // passive root listener, so preventDefault() in JSX would be ignored. We only
  // hijack the event when (a) the strip actually overflows and (b) the gesture
  // is predominantly vertical — leaving real horizontal trackpad scrolls and
  // non-overflowing strips to behave (and page-scroll) normally.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1
      el.scrollLeft += e.deltaY * factor
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div ref={ref} className={clsx('tabs', sticky && 'tabs--sticky')} role="tablist">
      {items.map((item) => {
        const active = item.key === activeKey
        const inner = (
          <>
            {item.label}
            {active && <span className="tab__underline" />}
          </>
        )
        const cls = clsx('tab', active && 'tab--active')
        if (item.to) {
          return (
            <Link key={item.key} to={item.to} role="tab" aria-selected={active} className={cls}>
              {inner}
            </Link>
          )
        }
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            className={cls}
            onClick={() => onChange?.(item.key)}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}
