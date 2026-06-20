import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

/**
 * Mobile chrome: the floating top + bottom bars own all phone-width navigation
 * chrome, decoupled from the desktop TopBar/BottomTabBar. Screens feed per-screen
 * content into the bars through PORTALS (same pattern as PageAside) so the
 * screen's own data/context wiring stays intact while the shell owns bar layout.
 *
 * Slots:
 *  - topLeft / topRight: edges of the floating top bar. topLeft is counted so the
 *    bar can fall back to a default back button when a screen provides nothing.
 *  - bottom: the right region of the floating bottom bar (the "site-specific
 *    content", e.g. a chat composer). Counted so the bar knows whether a screen
 *    has contextual content; if none, it shows the nav permanently.
 *  - title: a plain string fallback shown centered in the top bar for screens
 *    that just want a label (set via useMobileTitle).
 *
 * The bottom bar has a mode: 'context' shows the screen's bottom content, 'nav'
 * shows the primary nav row. The multi button toggles it; it resets to 'context'
 * on navigation (handled by MobileBottomBar).
 */

type CountedSlot = 'topLeft' | 'bottom' | 'topFill'

interface MobileChromeValue {
  topLeftEl: HTMLElement | null
  topRightEl: HTMLElement | null
  bottomEl: HTMLElement | null
  /** Full-width top-bar slot: when filled it replaces left/title/right (e.g. the
   *  search input becomes the whole top bar). */
  topFillEl: HTMLElement | null
  setTopLeftEl: (el: HTMLElement | null) => void
  setTopRightEl: (el: HTMLElement | null) => void
  setBottomEl: (el: HTMLElement | null) => void
  setTopFillEl: (el: HTMLElement | null) => void
  counts: Record<CountedSlot, number>
  bump: (slot: CountedSlot, delta: number) => void
  title: string | null
  setTitle: (t: string | null) => void
  /** User's explicit bottom-bar toggle for this route; null = follow the default. */
  userMode: 'context' | 'nav' | null
  setUserMode: (m: 'context' | 'nav' | null) => void
  /** Whether the active screen wants its bottom content shown by default (chat). */
  bottomDefaultOpen: boolean
  setBottomDefaultOpen: (b: boolean) => void
  /** When true the top bar is suppressed (e.g. immersive thread view). */
  hideTop: boolean
  setHideTop: (b: boolean) => void
  /** Transient: the top bar is faded out because the feed is scrolling down.
   *  (Distinct from hideTop — this is reversible per scroll-direction.) */
  topHiddenByScroll: boolean
  setTopHiddenByScroll: (b: boolean) => void
}

const Ctx = createContext<MobileChromeValue | null>(null)

/** Internal: used by the bars, which always render inside the provider. */
export function useMobileChromeCtx(): MobileChromeValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMobileChromeCtx must be used within <MobileChromeProvider>')
  return v
}

/** Non-throwing accessor for components that also render outside the mobile shell
 *  (e.g. InfiniteList on desktop). Returns null when there's no provider. */
export function useMobileChromeOptional(): MobileChromeValue | null {
  return useContext(Ctx)
}

/**
 * Fade the floating top bar out on scroll-down, back in on scroll-up, for a given
 * scroller. Pass a ref to the scroll element, or omit it to track the window
 * scroll (document-scrolled screens like profile feeds). Hysteresis (act past a
 * 6px delta) avoids momentum flicker; within 64px of the top the bar is always
 * shown. Resets to visible on unmount/disable so the next screen never inherits a
 * hidden bar. No-op off the mobile shell (no provider) or when disabled.
 */
export function useFadeTopBarOnScroll(
  ref?: RefObject<HTMLElement | null>,
  enabled = true,
): void {
  const setTopHidden = useContext(Ctx)?.setTopHiddenByScroll
  useEffect(() => {
    if (!enabled || !setTopHidden) return
    const el = ref?.current ?? null
    const target: HTMLElement | Window = el ?? window
    const getY = () => (el ? el.scrollTop : window.scrollY)
    let lastY = getY()
    const onScroll = () => {
      const y = getY()
      const dy = y - lastY
      if (y <= 64) setTopHidden(false)
      else if (dy > 6) setTopHidden(true)
      else if (dy < -6) setTopHidden(false)
      if (Math.abs(dy) > 6) lastY = y
    }
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      setTopHidden(false)
    }
  }, [ref, enabled, setTopHidden])
}

export function MobileChromeProvider({ children }: { children: ReactNode }) {
  const [topLeftEl, setTopLeftEl] = useState<HTMLElement | null>(null)
  const [topRightEl, setTopRightEl] = useState<HTMLElement | null>(null)
  const [bottomEl, setBottomEl] = useState<HTMLElement | null>(null)
  const [topFillEl, setTopFillEl] = useState<HTMLElement | null>(null)
  const [counts, setCounts] = useState<Record<CountedSlot, number>>({ topLeft: 0, bottom: 0, topFill: 0 })
  const [title, setTitle] = useState<string | null>(null)
  const [userMode, setUserMode] = useState<'context' | 'nav' | null>(null)
  const [bottomDefaultOpen, setBottomDefaultOpen] = useState(false)
  const [hideTop, setHideTop] = useState(false)
  const [topHiddenByScroll, setTopHiddenByScroll] = useState(false)

  const bump = useCallback((slot: CountedSlot, delta: number) => {
    setCounts((c) => ({ ...c, [slot]: c[slot] + delta }))
  }, [])

  const value = useMemo(
    () => ({
      topLeftEl,
      topRightEl,
      bottomEl,
      topFillEl,
      setTopLeftEl,
      setTopRightEl,
      setBottomEl,
      setTopFillEl,
      counts,
      bump,
      title,
      setTitle,
      userMode,
      setUserMode,
      bottomDefaultOpen,
      setBottomDefaultOpen,
      hideTop,
      setHideTop,
      topHiddenByScroll,
      setTopHiddenByScroll,
    }),
    [topLeftEl, topRightEl, bottomEl, topFillEl, counts, bump, title, userMode, bottomDefaultOpen, hideTop, topHiddenByScroll],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

type SlotName = 'topLeft' | 'topRight' | 'bottom' | 'topFill'

/**
 * Portal a screen's node into a bar slot. Tolerates a missing provider (returns
 * null) so the same screen component can render these unconditionally on desktop,
 * where there is no mobile chrome — the portal simply no-ops.
 */
function Portal({ slot, children }: { slot: SlotName; children: ReactNode }) {
  const ctx = useContext(Ctx)
  // Depend only on the STABLE bump fn, never the ctx object: ctx's identity
  // changes whenever counts change (the value is memoized on counts), so
  // depending on ctx here would re-fire bump → change counts → change ctx →
  // re-fire forever (an infinite render loop).
  const bump = ctx?.bump
  const counted = slot === 'topLeft' || slot === 'bottom' || slot === 'topFill'
  useEffect(() => {
    if (!bump || !counted) return
    bump(slot as CountedSlot, 1)
    return () => bump(slot as CountedSlot, -1)
  }, [bump, slot, counted])

  if (!ctx) return null
  const el =
    slot === 'topLeft'
      ? ctx.topLeftEl
      : slot === 'topRight'
        ? ctx.topRightEl
        : slot === 'topFill'
          ? ctx.topFillEl
          : ctx.bottomEl
  return el ? createPortal(children, el) : null
}

export function MobileTopLeft({ children }: { children: ReactNode }) {
  return <Portal slot="topLeft">{children}</Portal>
}
export function MobileTopRight({ children }: { children: ReactNode }) {
  return <Portal slot="topRight">{children}</Portal>
}
/** Fill the entire top bar with this content (replaces left/title/right). */
export function MobileTopBarFill({ children }: { children: ReactNode }) {
  return <Portal slot="topFill">{children}</Portal>
}
export function MobileBottomContent({
  children,
  defaultShown = false,
}: {
  children: ReactNode
  /** Show this content (vs the nav) by default when the screen opens. */
  defaultShown?: boolean
}) {
  const ctx = useContext(Ctx)
  const setBottomDefaultOpen = ctx?.setBottomDefaultOpen
  useEffect(() => {
    if (!setBottomDefaultOpen || !defaultShown) return
    setBottomDefaultOpen(true)
    return () => setBottomDefaultOpen(false)
  }, [setBottomDefaultOpen, defaultShown])
  return <Portal slot="bottom">{children}</Portal>
}

/** Suppress the floating top bar while mounted (immersive screens). No-op on desktop. */
export function useHideMobileTopBar(): void {
  const ctx = useContext(Ctx)
  const setHideTop = ctx?.setHideTop
  useEffect(() => {
    if (!setHideTop) return
    setHideTop(true)
    return () => setHideTop(false)
  }, [setHideTop])
}

/** Set the top bar's centered title fallback while mounted. No-op on desktop. */
export function useMobileTitle(title: string | null): void {
  const ctx = useContext(Ctx)
  // Depend on the stable setTitle, not ctx — see the note in Portal: depending on
  // ctx (whose identity changes with counts) would loop forever.
  const setTitle = ctx?.setTitle
  useEffect(() => {
    if (!setTitle) return
    setTitle(title)
    return () => setTitle(null)
  }, [setTitle, title])
}
