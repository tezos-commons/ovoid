import { useCallback, useRef } from 'react'

/**
 * Fire `onLongPress` after a touch is held for `ms`, or on a desktop right-click
 * (contextmenu). Movement or release before the threshold cancels it. Returns
 * handlers to spread onto the target element.
 *
 * The press is treated as "consumed" so a following click can be suppressed by
 * the caller (a long-press shouldn't also activate the element).
 */
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const start = useCallback(() => {
    fired.current = false
    clear()
    timer.current = setTimeout(() => {
      fired.current = true
      onLongPress()
    }, ms)
  }, [clear, onLongPress, ms])

  return {
    didLongPress: () => fired.current,
    handlers: {
      onTouchStart: start,
      onTouchEnd: clear,
      onTouchMove: clear,
      onTouchCancel: clear,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        onLongPress()
      },
    },
  }
}
