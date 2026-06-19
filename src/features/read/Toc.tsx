import { useEffect, useRef, useState, type RefObject } from 'react'

export interface Heading {
  id: string
  text: string
  level: number
}

/**
 * Read the rendered article's headings straight from the DOM (h2/h3 with ids,
 * which both renderers emit). DOM-sourced so it never has to re-derive slugs and
 * can't drift from what's actually on the page. Re-runs when `dep` changes.
 */
export function useTocHeadings(ref: RefObject<HTMLElement | null>, dep: unknown): Heading[] {
  const [headings, setHeadings] = useState<Heading[]>([])
  useEffect(() => {
    const root = ref.current
    if (!root) {
      setHeadings([])
      return
    }
    const els = Array.from(root.querySelectorAll<HTMLElement>('h2[id], h3[id]'))
    setHeadings(els.map((el) => ({ id: el.id, text: el.textContent ?? '', level: Number(el.tagName[1]) })))
  }, [ref, dep])
  return headings
}

// Opacity ramp: fully faded at/inside the box, down to MIN once the cursor is
// MAX_DIST px away — so it stays unobtrusive until you reach for it.
const MIN_OPACITY = 0.22
const MAX_DIST = 240

/**
 * Fixed "On this page" nav (stays put while scrolling). Transparent by default,
 * fading in by cursor proximity. Hidden below 3 headings or on narrow viewports.
 */
export function Toc({ headings }: { headings: Heading[] }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let x = 0
    let y = 0
    const apply = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const dx = Math.max(r.left - x, 0, x - r.right)
      const dy = Math.max(r.top - y, 0, y - r.bottom)
      const dist = Math.hypot(dx, dy)
      const t = Math.min(dist / MAX_DIST, 1)
      el.style.opacity = String(1 - t * (1 - MIN_OPACITY))
    }
    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [headings.length])

  if (headings.length < 3) return null
  return (
    <nav ref={ref} className="rdr-toc" aria-label="On this page">
      <div className="rdr-toc__title">On this page</div>
      <ul>
        {headings.map((h) => (
          <li key={h.id} data-level={h.level}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
