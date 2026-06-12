import { useEffect, useRef, type ReactNode, type TouchEvent } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { PageAside } from '@/components/layout'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { useIsMobile } from '@/lib/use-is-mobile'
import './settings.css'

import SettingsHome from './SettingsHome'
import { SettingsNav } from './SettingsNav'
import AccountSettings from './AccountSettings'
import AppearanceSettings from './AppearanceSettings'
import ModerationSettings from './ModerationSettings'
import ModerationListScreen from './ModerationListScreen'
import AppPasswordsSettings from './AppPasswordsSettings'
import NotificationSettings from './NotificationSettings'
import WalletSettings from './WalletSettings'
import {
  PrivacySettings,
  AccessibilitySettings,
  LanguageSettings,
  AboutSettings,
} from './SimpleScreens'

/**
 * Settings tree. Mounted by the top-level router at `settings/*`, so the routes
 * here are relative to `/settings`. The whole subtree is auth-protected by the
 * router's protectedEl wrapper.
 *
 * Two layouts over ONE shared route table (so they can't drift):
 *  - Desktop: master/detail — the section menu is a persistent aside, the
 *    detail renders alongside.
 *  - Mobile: a native-style pager — the index page IS the menu, and each
 *    section is its own full-bleed page that slides in (see MobileSettings).
 */

/** Detail routes shared by both layouts. */
const DETAIL_ROUTES: Array<{ path: string; element: ReactNode }> = [
  { path: 'account', element: <AccountSettings /> },
  { path: 'privacy', element: <PrivacySettings /> },
  { path: 'notifications', element: <NotificationSettings /> },
  { path: 'moderation', element: <ModerationSettings /> },
  { path: 'moderation/muted', element: <ModerationListScreen kind="muted" /> },
  { path: 'moderation/blocked', element: <ModerationListScreen kind="blocked" /> },
  { path: 'appearance', element: <AppearanceSettings /> },
  { path: 'accessibility', element: <AccessibilitySettings /> },
  { path: 'languages', element: <LanguageSettings /> },
  { path: 'app-passwords', element: <AppPasswordsSettings /> },
  { path: 'wallet', element: <WalletSettings /> },
  { path: 'about', element: <AboutSettings /> },
]

function detailRoutes() {
  return (
    <>
      {DETAIL_ROUTES.map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}
      {/* Unknown sub-path → settings root */}
      <Route path="*" element={<Navigate to="/settings" replace />} />
    </>
  )
}

export default function SettingsScreen() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileSettings />
  return (
    <>
      <PageAside>
        <SettingsNav />
      </PageAside>
      <Routes>
        <Route index element={<SettingsHome />} />
        {detailRoutes()}
      </Routes>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Mobile: full-page pager with directional slide                      */
/* ------------------------------------------------------------------ */

/** Path depth below /settings — 0 = menu, 1+ = detail (drives slide direction). */
function settingsDepth(pathname: string): number {
  return pathname.replace(/^\/settings\/?/, '').split('/').filter(Boolean).length
}

/** One level up the settings path: /settings/moderation/muted → /settings/moderation. */
function parentSettingsPath(pathname: string): string {
  const segments = pathname.replace(/^\/settings\/?/, '').split('/').filter(Boolean)
  return segments.length <= 1 ? '/settings' : `/settings/${segments.slice(0, -1).join('/')}`
}

/* Edge-swipe-back tuning. The start zone is wider than the OS edge band so the
   gesture is forgiving; the 1.5× horizontal dominance and the vertical bail-out
   keep ordinary page scrolling from ever triggering it. */
const SWIPE_EDGE = 32 // px from the left edge where the gesture may start
const SWIPE_DISTANCE = 70 // px of rightward travel that commits the back-nav
const SWIPE_VERTICAL_BAIL = 44 // px of vertical travel that cancels the gesture

/**
 * Each navigation remounts the page wrapper (keyed by pathname) so the slide
 * animation replays: deeper paths enter from the right, shallower from the
 * left — mirroring a native settings stack. The detail screens' own
 * ScreenHeaders (hidden globally on mobile) are re-enabled within
 * .settings-mobile via settings.css and provide the back affordance.
 */
function MobileSettings() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const depth = settingsDepth(pathname)
  const prevDepth = useRef(depth)
  const direction = depth >= prevDepth.current ? 'fwd' : 'back'
  useEffect(() => {
    prevDepth.current = depth
  }, [depth])

  // Swipe-back: a touch starting at the left edge and travelling right pops one
  // level up the settings path (same destination as the header back arrow, so a
  // deep link's missing history can't swipe you out of the app). Navigating to
  // the parent lowers `depth`, which selects the slide-back animation.
  const swipe = useRef<{ x: number; y: number; live: boolean } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    swipe.current =
      depth > 0 && t.clientX <= SWIPE_EDGE ? { x: t.clientX, y: t.clientY, live: true } : null
  }
  const onTouchMove = (e: TouchEvent) => {
    const start = swipe.current
    if (!start?.live) return
    const t = e.touches[0]
    const dx = t.clientX - start.x
    const dy = Math.abs(t.clientY - start.y)
    if (dy > SWIPE_VERTICAL_BAIL && dx < SWIPE_DISTANCE) {
      start.live = false // it's a scroll, not a back gesture
      return
    }
    if (dx >= SWIPE_DISTANCE && dx > dy * 1.5) {
      start.live = false // commit once per touch
      navigate(parentSettingsPath(pathname))
    }
  }
  const onTouchEnd = () => {
    swipe.current = null
  }

  return (
    <div
      className="settings-mobile"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div key={pathname} className={`settings-mobile__page settings-mobile__page--${direction}`}>
        <Routes>
          <Route index element={<MobileSettingsHome />} />
          {detailRoutes()}
        </Routes>
      </div>
    </div>
  )
}

/** Mobile index: the menu IS the page (no aside on phones). */
function MobileSettingsHome() {
  return (
    <>
      <ScreenHeader title="Settings" showBack />
      <SettingsNav />
    </>
  )
}
