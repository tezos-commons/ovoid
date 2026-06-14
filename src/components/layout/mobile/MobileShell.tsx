import { useEffect, type ReactNode } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { ShellLayout } from '../PageLayout'
import { RouteTransition } from '../RouteTransition'
import { haptic } from '@/lib/haptics'
import { MobileChromeProvider, useMobileChromeCtx } from './MobileChrome'
import { MobileTopBar } from './MobileTopBar'
import { MobileBottomBar } from './MobileBottomBar'
import './mobile.css'

export interface MobileShellProps {
  children: ReactNode
  /** Route-decided full-width page area (no reserved aside). See ShellLayout. */
  fullWidth?: boolean
}

/**
 * Phone-width app shell, fully decoupled from the desktop chrome. Two floating
 * liquid-glass bars (top + bottom) hover over the page content, which scrolls
 * behind them. The content area reuses ShellLayout so screens keep the
 * PageAside / usePageFullWidth contract; mobile CSS makes that area full-bleed.
 *
 * Navigation is native-feeling: a new screen slides in (from the right going
 * forward, the left going back), and an edge swipe steps through history.
 */
export function MobileShell({ children, fullWidth }: MobileShellProps) {
  return (
    <MobileChromeProvider>
      <MobileShellChrome fullWidth={fullWidth}>{children}</MobileShellChrome>
    </MobileChromeProvider>
  )
}

/** Inner shell: consumes the chrome context (for hideTop) the provider supplies. */
function MobileShellChrome({ children, fullWidth }: MobileShellProps) {
  const { hideTop } = useMobileChromeCtx()
  useEdgeSwipeNav()
  useKeyboardInset()
  return (
    <div className={clsx('mobile-shell', hideTop && 'mobile-shell--no-top')}>
      <MobileTopBar />
      <ShellLayout fullWidth={fullWidth}>
        <RouteTransition variant="slide">{children}</RouteTransition>
      </ShellLayout>
      <MobileBottomBar />
    </div>
  )
}

/** Text-entry elements that the on-screen keyboard is opening for. */
function isTextEntry(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') {
    // Non-text inputs (checkbox, button, etc.) don't summon the keyboard.
    const t = (el as HTMLInputElement).type
    return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset'].includes(t)
  }
  return false
}

/**
 * Mirror the on-screen keyboard's height into a `--kb` CSS variable on :root, and
 * scroll a mid-screen focused input into view when the keyboard opens.
 *
 * iOS Safari keeps position:fixed bound to the layout viewport, which does NOT
 * shrink when the keyboard opens — so the floating bottom bar (and the chat
 * composer portaled into it) would hide behind the keyboard. Surfaces add
 * var(--kb) to their bottom offset to ride above it. No-op where visualViewport
 * is unavailable; --kb then stays at its 0px default.
 */
function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let prev = 0
    const update = () => {
      // Overlap = the slice of the layout viewport the visual viewport no longer
      // covers at the bottom. Rounded to avoid sub-pixel thrash from elastic
      // scroll firing a stream of resize/scroll events.
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty('--kb', `${Math.round(overlap)}px`)
      // Keyboard just opened (not minor jitter, not closing): bring a focused
      // input into view. Anchored inputs (chat composer in the fixed bottom bar,
      // the compose sheet toolbar) have no scroll ancestor, so this no-ops for
      // them — only inputs inside a scrollable form (edit profile/list, alt text,
      // settings) actually move. rAF lets the --kb-derived heights settle first.
      if (overlap > prev + 40 && isTextEntry(document.activeElement)) {
        const el = document.activeElement as HTMLElement
        requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      }
      prev = overlap
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      root.style.removeProperty('--kb')
    }
  }, [])
}

// Edge-swipe tuning: a forgiving start zone wider than the OS edge band; the 1.5×
// horizontal dominance + vertical bail keep ordinary scrolling from triggering it.
const SWIPE_EDGE = 30 // px from a screen edge where the gesture may start
const SWIPE_DISTANCE = 64 // px of travel that commits the navigation
const SWIPE_VERTICAL_BAIL = 44 // px of vertical travel that cancels it

interface SwipeState {
  x: number
  y: number
  dir: 'back' | 'fwd'
  live: boolean
}

/**
 * App-wide edge swipe: a touch starting at the left edge and moving right pops
 * back; starting at the right edge and moving left goes forward. Listens on the
 * window so it covers every screen. Skips the settings pager, which runs its own
 * (parent-path) swipe.
 */
function useEdgeSwipeNav(): void {
  const navigate = useNavigate()
  useEffect(() => {
    let s: SwipeState | null = null
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        s = null
        return
      }
      const t = e.touches[0]
      const target = e.target as HTMLElement | null
      // The settings pager runs its own swipe; the lightbox pages images on swipe.
      if (target?.closest?.('.settings-mobile') || target?.closest?.('.lightbox')) {
        s = null
        return
      }
      const fromLeft = t.clientX <= SWIPE_EDGE
      const fromRight = t.clientX >= window.innerWidth - SWIPE_EDGE
      s = fromLeft || fromRight ? { x: t.clientX, y: t.clientY, dir: fromLeft ? 'back' : 'fwd', live: true } : null
    }
    const onMove = (e: TouchEvent) => {
      if (!s?.live) return
      const t = e.touches[0]
      const dx = t.clientX - s.x
      const dy = Math.abs(t.clientY - s.y)
      const travel = s.dir === 'back' ? dx : -dx
      if (dy > SWIPE_VERTICAL_BAIL && travel < SWIPE_DISTANCE) {
        s.live = false // it's a vertical scroll, not a back/forward gesture
        return
      }
      if (travel >= SWIPE_DISTANCE && travel > dy * 1.5) {
        s.live = false // commit once per touch
        haptic('medium') // confirm the navigation gesture took
        navigate(s.dir === 'back' ? -1 : 1)
      }
    }
    const onEnd = () => {
      s = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [navigate])
}
