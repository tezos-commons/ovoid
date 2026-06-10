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
 *
 * `wheel: true` additionally maps the (usually vertical) wheel delta onto the
 * horizontal axis, so a plain mouse wheel scrolls the strip — opt-in, since most
 * consumers (tab/menu strips) want the page to keep scrolling vertically.
 */
export function useDragScroll<T extends HTMLElement = HTMLElement>(
  opts: { wheel?: boolean } = {},
) {
  const ref = useRef<T>(null)
  const { wheel = false } = opts

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let active = false
    let moved = false
    let startX = 0
    let startScroll = 0

    // Wheel animation state: lerp scrollLeft toward `target` each frame so a
    // fast flick stays fast (deltas accumulate) but never jumps abruptly.
    let raf = 0
    let target = 0
    const stopWheelAnim = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      // Native scrolling handles touch; only drive mouse/pen drags, and only
      // when there's actually something to scroll.
      if (e.pointerType === 'touch' || e.button !== 0 || el.scrollWidth <= el.clientWidth) {
        return
      }
      // A drag takes over from any in-flight wheel glide so they don't fight.
      stopWheelAnim()
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

    // Ease scrollLeft toward `target`; ~0.2/frame is fast but never abrupt.
    const glide = () => {
      const diff = target - el.scrollLeft
      if (Math.abs(diff) < 0.5) {
        el.scrollLeft = target
        raf = 0
        return
      }
      el.scrollLeft += diff * 0.2
      raf = requestAnimationFrame(glide)
    }

    // Translate wheel scrolling onto the horizontal axis. Take whichever axis
    // the device reports (trackpads send deltaX; mouse wheels deltaY), and only
    // swallow the event while there's still room to scroll that way — at either
    // end we let the wheel fall through so the page keeps scrolling.
    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (delta === 0) return
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft >= max - 1
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return
      e.preventDefault()
      // Accumulate onto the live target while gliding so rapid ticks stack.
      const base = raf ? target : el.scrollLeft
      target = Math.max(0, Math.min(max, base + delta))
      if (!raf) raf = requestAnimationFrame(glide)
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    // A native drag (e.g. dragging an <img>) ends the gesture with
    // pointercancel, not pointerup — without this, `active` would stay true and
    // subsequent button-less moves would keep scrolling.
    window.addEventListener('pointercancel', endDrag)
    el.addEventListener('click', onClickCapture, true)
    if (wheel) el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('click', onClickCapture, true)
      if (wheel) el.removeEventListener('wheel', onWheel)
      stopWheelAnim()
    }
  }, [wheel])

  return ref
}
