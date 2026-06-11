import { useEffect, useRef } from 'react'
import { QUICK_REACTIONS } from './MessageReactions'

export interface ReactionPickerProps {
  /** Side the bubble is on, so the picker aligns to the same edge. */
  align: 'start' | 'end'
  onPick: (value: string) => void
  onClose: () => void
}

/**
 * Small popover of quick-reaction emojis, anchored above a message bubble. Opens
 * on long-press (mobile) / right-click (desktop). Closes on outside tap, Escape,
 * or selection.
 */
export function ReactionPicker({ align, onPick, onClose }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Defer so the opening press doesn't immediately close it.
    const id = setTimeout(() => {
      document.addEventListener('pointerdown', onDown)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div ref={ref} className={`reaction-picker reaction-picker--${align}`} role="menu">
      {QUICK_REACTIONS.map((value) => (
        <button
          key={value}
          type="button"
          className="reaction-picker__btn"
          onClick={() => onPick(value)}
          aria-label={`React ${value}`}
        >
          {value}
        </button>
      ))}
    </div>
  )
}
