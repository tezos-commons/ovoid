import { useEffect, useRef } from 'react'

/**
 * Click-and-drag horizontal scrolling for an overflow-x container.
 *
 * Inert unless the element actually overflows horizontally — so the same menu in
 * its vertical (desktop) layout, where there is no horizontal overflow, behaves
 * normally and clicks are never swallowed. Touch input is left to native
 * momentum scrolling; only mouse/pen drags are handled here. A drag past a small
 * threshold flips the element to `.is-dragging` and suppresses the trailing
 * click, so dragging the strip doesn't also activate the tab under the cursor.
 */
export function useDragScroll<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let active = false
    let moved = false
    let startX = 0
    let startScroll = 0

    const onPointerDown = (e: PointerEvent) => {
      // Native scrolling handles touch; only drive mouse/pen drags, and only
      // when there's actually something to scroll.
      if (e.pointerType === 'touch' || e.button !== 0 || el.scrollWidth <= el.clientWidth) {
        return
      }
      active = true
      moved = false
      startX = e.clientX
      startScroll = el.scrollLeft
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!active) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) > 4) {
        moved = true
        el.classList.add('is-dragging')
      }
      if (moved) {
        el.scrollLeft = startScroll - dx
        e.preventDefault()
      }
    }

    const endDrag = () => {
      active = false
      el.classList.remove('is-dragging')
    }

    // Capture phase so a drag's click is killed before it reaches a tab button.
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault()
        e.stopPropagation()
        moved = false
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    el.addEventListener('click', onClickCapture, true)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  return ref
}
