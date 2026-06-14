import clsx from 'clsx'
import { useNavigate, useLocation } from 'react-router-dom'
import { IconButton } from '../../IconButton'
import { BackIcon } from '../../Icon'
import { useMobileChromeCtx } from './MobileChrome'

/** Routes that are top-level destinations — no back affordance by default. */
const ROOT_PATHS = new Set(['/', '/search', '/notifications', '/messages', '/feeds', '/lists', '/settings'])

/**
 * Floating, liquid-glass top bar (mobile). A three-column grid: a left slot
 * (default: back button on non-root routes), a centered title fallback, and a
 * right slot. Screens fill the slots via <MobileTopLeft>/<MobileTopRight> and the
 * title via useMobileTitle.
 */
export function MobileTopBar() {
  const ctx = useMobileChromeCtx()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const showDefaultBack = ctx.counts.topLeft === 0 && !ROOT_PATHS.has(pathname)

  // Immersive screens (e.g. thread view) suppress the bar entirely.
  if (ctx.hideTop) return null

  // A screen can take over the whole bar (e.g. search → the search input).
  const hasFill = ctx.counts.topFill > 0

  return (
    <header className={clsx('mbar mbar--top liquid-glass', hasFill && 'mbar--fill')} role="banner">
      <span className="liquid-glass__layer" aria-hidden="true" />
      {/* Full-width slot — always mounted (portal target); shown only when filled. */}
      <div className="mbar__fill" ref={ctx.setTopFillEl} hidden={!hasFill} />
      {!hasFill && (
        <>
          <div className="mbar__side mbar__side--left" ref={ctx.setTopLeftEl}>
            {showDefaultBack && (
              <IconButton label="Back" onClick={() => navigate(-1)}>
                <BackIcon size={20} />
              </IconButton>
            )}
          </div>
          <div className="mbar__center">
            {ctx.title && <span className="mbar__title">{ctx.title}</span>}
          </div>
          <div className="mbar__side mbar__side--right" ref={ctx.setTopRightEl} />
        </>
      )}
    </header>
  )
}
