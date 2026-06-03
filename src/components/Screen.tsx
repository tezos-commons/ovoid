import type { ReactNode } from 'react'

export interface ScreenProps {
  /** Fixed top chrome (a ScreenHeader, optionally with tabs). Stays put. */
  top?: ReactNode
  /** The single scroll region. A virtualized list here gets a bounded parent. */
  children: ReactNode
}

/**
 * Bounded-height screen shell — the one place the full-height/scroll math lives.
 *
 * A flex column locked to --app-height (dynamic viewport minus the mobile tab
 * bar). The `top` chrome keeps its natural height; the body is the sole scroll
 * region (flex:1 1 0, min-height:0), so an InfiniteList inside has a properly
 * bounded scroll parent and virtualizes correctly. Screens adopting this no
 * longer reinvent `100vh` vs `100dvh` height arithmetic.
 */
export function Screen({ top, children }: ScreenProps) {
  return (
    <div className="screen">
      {top}
      <div className="screen__body">{children}</div>
    </div>
  )
}
