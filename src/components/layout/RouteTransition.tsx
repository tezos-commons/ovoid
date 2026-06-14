import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export type RouteTransitionVariant = 'slide' | 'fade'

/** Chat routes — moving between conversations stays within the one chat screen. */
function isChat(path: string): boolean {
  return path.startsWith('/messages')
}

/**
 * Replays an enter transition on each pathname change WITHOUT remounting the
 * screen. A stable wrapper (no React key) keeps the screen — and its virtualizers,
 * effects, scroll state — mounted; React Router swaps the Outlet content in place.
 * We just replay the CSS animation by toggling the --run class with a forced
 * reflow between, so it fires only on navigation, not on every re-render.
 *
 * Replays only when the PATHNAME changes (not on in-place search-param changes —
 * profile tab, notifications filter). Direction follows history: POP (back/
 * forward) gets the --back variant, PUSH/REPLACE the forward one.
 *
 * `slide` is the phone chrome's horizontal slide; `fade` is the desktop chrome's
 * subtler cross-fade + rise. Both share this mechanism and the CSS contract:
 * `.route-<variant>`, `.route-<variant>--run`, `.route-<variant>--back`.
 */
export function RouteTransition({
  variant,
  children,
}: {
  variant: RouteTransitionVariant
  children: ReactNode
}) {
  const base = variant === 'slide' ? 'route-slide' : 'route-fade'
  const { pathname } = useLocation()
  const navType = useNavigationType()
  const ref = useRef<HTMLDivElement>(null)
  // null so the very first mount also animates.
  const prevPath = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (prevPath.current === pathname) return
    const prev = prevPath.current
    prevPath.current = pathname
    const el = ref.current
    if (!el) return
    // Switching between conversations is staying within the chat screen, not a
    // screen change — don't replay the enter transition for /messages → /messages.
    if (prev && isChat(prev) && isChat(pathname)) return
    el.classList.remove(`${base}--run`)
    void el.offsetWidth // reflow: restart the animation from the first frame
    el.classList.toggle(`${base}--back`, navType === 'POP')
    el.classList.add(`${base}--run`)
  }, [pathname, navType, base])

  return (
    <div ref={ref} className={base}>
      {children}
    </div>
  )
}
