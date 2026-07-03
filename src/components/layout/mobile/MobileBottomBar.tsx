import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '../navItems'
import { PencilIcon } from '../../Icon'
import { Avatar } from '../../Avatar'
import { useAuth } from '@/lib/api/agent'
import { useLongPress } from '@/lib/use-long-press'
import { useComposer } from '@/store/compose-store'
import { useNavBadges } from '@/features/notifications/use-nav-badges'
import { NavBadge } from '../NavBadge'
import { useMobileChromeCtx } from './MobileChrome'
import { AccountSheet } from '@/features/auth/AccountSheet'

/** Nav shown when the multi button is toggled (and the default on screens with no
 *  contextual bottom content). Order/selection per the mobile spec. */
const MOBILE_NAV_KEYS = ['home', 'search', 'notifications', 'chat', 'profile'] as const

/**
 * Floating, liquid-glass bottom bar (mobile). Left: the multi button. Right: the
 * screen's contextual content (e.g. a chat composer) OR the primary nav row.
 *
 * The contextual slot stays mounted even while the nav is shown (it's just
 * hidden), so a screen's bottom content keeps its state — e.g. a half-typed chat
 * message survives a peek at the nav. The multi button toggles between the two;
 * mode resets to contextual on navigation.
 */
export function MobileBottomBar() {
  const ctx = useMobileChromeCtx()
  const { pathname } = useLocation()
  const { openCompose } = useComposer()
  const navRef = useRef<HTMLElement>(null)

  // Publish the bar's measured height so the scroll zones (--mbar-bottom-zone)
  // can reserve room for it. A multiline chat composer grows the bar past its
  // resting min-height; without this the bar would overlap the last messages.
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const root = document.documentElement
    const update = () =>
      root.style.setProperty('--mbar-bottom-real', `${el.getBoundingClientRect().height}px`)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--mbar-bottom-real')
    }
  }, [])

  // iOS UX: when a top-bar input (e.g. search) is focused and the on-screen
  // keyboard is up, the bottom bar would otherwise sit right on top of the
  // keyboard — distracting and useless while typing above. Hide it for that
  // case. Gated on a real keyboard overlap so an external keyboard (no on-screen
  // one) leaves the bar in place.
  const [hideForTopInput, setHideForTopInput] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    const compute = () => {
      const kbOpen = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) > 60 : false
      const active = document.activeElement
      const topBar = document.querySelector('.mbar--top')
      const focusInTop = !!(active && topBar?.contains(active))
      setHideForTopInput(kbOpen && focusInTop)
    }
    compute()
    vv?.addEventListener('resize', compute)
    vv?.addEventListener('scroll', compute)
    document.addEventListener('focusin', compute)
    document.addEventListener('focusout', compute)
    return () => {
      vv?.removeEventListener('resize', compute)
      vv?.removeEventListener('scroll', compute)
      document.removeEventListener('focusin', compute)
      document.removeEventListener('focusout', compute)
    }
  }, [])

  // Clear the user's manual toggle on navigation, so each screen opens at its
  // own default (chat → its composer; everything else → the nav).
  useEffect(() => {
    ctx.setUserMode(null)
    // ctx is stable enough; only the path drives the reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const hasContext = ctx.counts.bottom > 0
  // Default to the screen's composer only when it opts in (chat); otherwise nav.
  // A manual toggle (userMode) overrides the default for this route.
  const resolved = ctx.userMode ?? (ctx.bottomDefaultOpen && hasContext ? 'context' : 'nav')
  const showNav = resolved === 'nav' || !hasContext

  // Left button = write / nav toggle.
  //  - nav shown → pencil "write": reveal the screen's inline composer (chat) if
  //    it has one, else open the skeet composer modal (any other screen).
  //  - inline composer shown → grid: switch back to the nav.
  const onToggle = () => {
    if (!showNav) {
      ctx.setUserMode('nav')
    } else if (hasContext) {
      ctx.setUserMode('context')
    } else {
      openCompose()
    }
  }

  return (
    <nav
      ref={navRef}
      className={clsx('mbar mbar--bottom liquid-glass', hideForTopInput && 'mbar--kbhidden')}
      aria-label="Primary"
    >
      <span className="liquid-glass__layer" aria-hidden="true" />
      <button
        type="button"
        className={clsx('mbar__multi', showNav && 'mbar__multi--write')}
        aria-label={showNav ? 'Write' : 'Show navigation'}
        onClick={onToggle}
      >
        {showNav ? <PencilIcon size={22} /> : <MultiIcon />}
      </button>

      <div className="mbar__bottom-content">
        {/* Always mounted so portaled content keeps state; hidden under the nav. */}
        <div className="mbar__context" ref={ctx.setBottomEl} hidden={showNav} />
        {showNav && <MobileNavRow />}
      </div>
    </nav>
  )
}

function MobileNavRow() {
  const { did, isAuthed, handle, displayName, avatar } = useAuth()
  const badges = useNavBadges()
  const items = MOBILE_NAV_KEYS.map((k) => NAV_ITEMS.find((i) => i.key === k)!).filter(Boolean)

  // Profile tab: tap goes to the signed-in profile as before; a long press
  // opens the account switcher sheet instead of navigating.
  const [acctOpen, setAcctOpen] = useState(false)
  const acctPress = useLongPress(() => setAcctOpen(true))

  return (
    <div className="mbar__nav">
      {items.map((item) => {
        const me = item.key === 'profile' && isAuthed
        const to =
          item.authed && !isAuthed
            ? '/login'
            : item.key === 'profile' && did
              ? `/profile/${did}`
              : item.to
        return (
          <NavLink
            key={item.key}
            to={to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx('mbar__navitem', isActive && 'mbar__navitem--active', me && 'mbar__navitem--me')
            }
            aria-label={item.label}
            {...(me ? acctPress.handlers : null)}
            onClick={me ? (e) => acctPress.didLongPress() && e.preventDefault() : undefined}
          >
            {({ isActive }) => (
              <>
                {me ? (
                  <span className={clsx('mbar__me', isActive && 'mbar__me--active')}>
                    <Avatar size="xs" src={avatar} alt={handle} fallback={displayName || handle} />
                  </span>
                ) : (
                  item.icon(isActive)
                )}
                {item.key === 'notifications' && <NavBadge count={badges.notifications} />}
                {item.key === 'chat' && <NavBadge count={badges.chat} />}
              </>
            )}
          </NavLink>
        )
      })}
      <AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} />
    </div>
  )
}

/** The multi button glyph: a 2×2 cluster that reads as "more / menu". */
function MultiIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor" aria-hidden="true">
      <circle cx="7" cy="7" r="2.4" />
      <circle cx="17" cy="7" r="2.4" />
      <circle cx="7" cy="17" r="2.4" />
      <circle cx="17" cy="17" r="2.4" />
    </svg>
  )
}
