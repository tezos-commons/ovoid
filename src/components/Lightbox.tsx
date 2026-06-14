import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './Icon'
import { useUiStore } from '@/store/ui-store'
import { useCloseOnBack } from '@/lib/use-close-on-back'

/**
 * Minimal fullscreen image viewer: the image centered over a blurred wash of
 * itself. ESC, the close button, or a backdrop click closes it; ← / → (and
 * on-screen arrows) page through a multi-image post. Driven by ui-store's
 * lightbox slice; mounted once at the app root.
 */
export function Lightbox() {
  const lightbox = useUiStore((s) => s.lightbox)
  const close = useUiStore((s) => s.closeLightbox)
  const [index, setIndex] = useState(0)
  const lastWheel = useRef(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  // Back button / back-swipe closes the image viewer instead of navigating away.
  useCloseOnBack(!!lightbox, close)

  // Sync local index when a new lightbox opens.
  useEffect(() => {
    if (lightbox) setIndex(lightbox.index)
  }, [lightbox])

  // Lock document scroll while open. Lock the documentElement (the real scroller —
  // body overflow doesn't propagate to the viewport because html has overflow-x:
  // clip) and drop scrollbar-gutter, so neither the reserved gutter nor a live
  // scrollbar leaves a strip down the right edge of the fullscreen overlay, and
  // the list behind can't shift as it opens (matches NftBrowser).
  useEffect(() => {
    if (!lightbox) return
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    const prevGutter = html.style.scrollbarGutter
    html.style.overflow = 'hidden'
    html.style.scrollbarGutter = 'auto'
    return () => {
      html.style.overflow = prevOverflow
      html.style.scrollbarGutter = prevGutter
    }
  }, [lightbox])

  const count = lightbox?.images.length ?? 0

  useEffect(() => {
    if (!lightbox) return
    // ESC is handled globally (useEscapeBack) as a back-step; here we only page.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && count > 1) setIndex((i) => (i + 1) % count)
      else if (e.key === 'ArrowLeft' && count > 1) setIndex((i) => (i - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, count])

  // Scroll (wheel / trackpad) to page through images, throttled so one gesture
  // advances by a single image rather than skipping several.
  const onWheel = (e: React.WheelEvent) => {
    if (count <= 1) return
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    if (Math.abs(delta) < 8) return
    const now = Date.now()
    if (now - lastWheel.current < 250) return
    lastWheel.current = now
    setIndex((i) => (delta > 0 ? (i + 1) % count : (i - 1 + count) % count))
  }

  // Touch: a horizontal swipe pages through the gallery. The swiped flag
  // suppresses the backdrop-close click that would otherwise follow the gesture.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    swiped.current = false
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current
    touchStart.current = null
    if (!s || count <= 1) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      swiped.current = true
      setIndex((i) => (dx < 0 ? (i + 1) % count : (i - 1 + count) % count))
    }
  }
  const onBackdropClick = () => {
    if (swiped.current) {
      swiped.current = false
      return
    }
    close()
  }

  if (!lightbox || count === 0) return null
  const img = lightbox.images[Math.min(index, count - 1)]

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      onClick={onBackdropClick}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="lightbox__backdrop" style={{ backgroundImage: `url(${img.src})` }} aria-hidden />

      <button className="lightbox__close" onClick={close} aria-label="Close">
        <CloseIcon size={22} />
      </button>

      {count > 1 && (
        <button
          className="lightbox__nav lightbox__nav--prev"
          aria-label="Previous"
          onClick={(e) => {
            e.stopPropagation()
            setIndex((i) => (i - 1 + count) % count)
          }}
        >
          ‹
        </button>
      )}

      <img
        className="lightbox__img"
        src={img.src}
        alt={img.alt ?? ''}
        onClick={(e) => e.stopPropagation()}
      />

      {count > 1 && (
        <>
          <button
            className="lightbox__nav lightbox__nav--next"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation()
              setIndex((i) => (i + 1) % count)
            }}
          >
            ›
          </button>
          <div className="lightbox__count">
            {index + 1} / {count}
          </div>
        </>
      )}
    </div>
  )
}
