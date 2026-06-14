import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './tooltip.css'

export interface TooltipProps {
  /** The tooltip text. */
  label: string
  children: ReactNode
  /** Side of the anchor to place the bubble. Default 'bottom'. */
  placement?: 'top' | 'bottom'
}

interface Pos {
  x: number
  y: number
}

const SHOW_DELAY = 350

/**
 * Lightweight hover/focus tooltip. Replaces native `title=` so timing and styling
 * are consistent and it surfaces on keyboard focus too (a bare title never does).
 * The bubble is portaled to body and position:fixed at the anchor's viewport rect,
 * so it's never clipped by an overflow ancestor. Purely presentational — keep an
 * aria-label on the trigger for the accessible name.
 */
export function Tooltip({ label, children, placement = 'bottom' }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [pos, setPos] = useState<Pos | null>(null)

  const show = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({
        x: r.left + r.width / 2,
        y: placement === 'bottom' ? r.bottom + 8 : r.top - 8,
      })
    }, SHOW_DELAY)
  }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setPos(null)
  }

  return (
    <span
      ref={anchorRef}
      className="tooltip-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos &&
        createPortal(
          <span
            className={`tooltip tooltip--${placement}`}
            style={{ left: pos.x, top: pos.y }}
            role="tooltip"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  )
}
