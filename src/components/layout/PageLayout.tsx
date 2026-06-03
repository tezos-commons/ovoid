import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

/**
 * Shell layout primitive: a rounded nav panel + a two-column page area
 * (a page-specific left aside + flexible main content).
 *
 * The aside is filled via a PORTAL, not by passing a node up through context.
 * A screen renders <PageAside>…</PageAside> and its content is portaled into the
 * shell's reserved aside column. This keeps the screen's own data/context wiring
 * (the card needs the profile the screen already loaded) while letting the shell
 * own column layout — and avoids the re-render loop you'd get from storing an
 * always-fresh element in parent state.
 *
 * `usePageFullWidth()` lets a screen (e.g. Chat's own master/detail) drop the
 * reserved aside and span the whole page area.
 */
interface ShellSlots {
  asideEl: HTMLElement | null
  setFullWidth: (full: boolean) => void
}

const ShellSlotsCtx = createContext<ShellSlots | null>(null)

function useShellSlots(): ShellSlots {
  const ctx = useContext(ShellSlotsCtx)
  if (!ctx) throw new Error('useShellSlots must be used within <ShellLayout>')
  return ctx
}

export interface ShellLayoutProps {
  /**
   * Force the full-width (no reserved aside) page area, decided by the route
   * before its (lazy) screen mounts. This avoids a width jump while the screen's
   * chunk loads — the Suspense fallback already renders at the final width. A
   * mounted screen can still opt in dynamically via usePageFullWidth().
   */
  fullWidth?: boolean
  /** The route outlet — rendered as the page area's main content. */
  children: ReactNode
}

export function ShellLayout({ fullWidth = false, children }: ShellLayoutProps) {
  // asideEl is held in state (not a plain ref) so <PageAside> consumers re-render
  // and portal once the container has mounted.
  const [asideEl, setAsideEl] = useState<HTMLElement | null>(null)
  const [fullWidthState, setFullWidth] = useState(false)
  const effectiveFull = fullWidth || fullWidthState

  return (
    <ShellSlotsCtx.Provider value={{ asideEl, setFullWidth }}>
      <div className="shell">
        <div className={clsx('page', effectiveFull && 'page--full')}>
          <aside className="page__aside" ref={setAsideEl} aria-label="Page sidebar" />
          <main className="page__main">{children}</main>
        </div>
      </div>
    </ShellSlotsCtx.Provider>
  )
}

/** Portal children into the shell's reserved left aside column. */
export function PageAside({ children }: { children: ReactNode }) {
  const { asideEl } = useShellSlots()
  return asideEl ? createPortal(children, asideEl) : null
}

/**
 * While mounted, the page area drops its reserved aside and spans full width.
 * Applied in a layout effect (pre-paint) so a full-width screen never flashes at
 * the narrower two-column width on mount.
 */
export function usePageFullWidth(): void {
  const { setFullWidth } = useShellSlots()
  useLayoutEffect(() => {
    setFullWidth(true)
    return () => setFullWidth(false)
  }, [setFullWidth])
}
