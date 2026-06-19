import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { UserFab } from './UserFab'
import { ShellLayout } from './PageLayout'
import { RouteTransition } from './RouteTransition'
import { MobileShell } from './mobile/MobileShell'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useWarmNavDestinations } from '@/features/prefetch-routes'
import { useSettingsSync } from '@/features/settings/use-settings-sync'
import './layout.css'

export interface AppShellProps {
  children: ReactNode
  /** Open the global compose modal (wired by RootLayout). */
  onNewPost?: () => void
  /** Route-decided full-width page area (no reserved aside). See ShellLayout. */
  fullWidth?: boolean
}

/**
 * App shell. Two fully decoupled chromes:
 *  - Desktop: a sticky top bar holding the primary nav, above a two-column page
 *    area (a page-specific left aside via <PageAside> + flexible main content),
 *    plus the account avatar FAB.
 *  - Mobile: the MobileShell — floating liquid-glass top + bottom bars hovering
 *    over a full-bleed content area.
 *
 * Both wrap the page area in ShellLayout, so screens keep the PageAside /
 * usePageFullWidth contract regardless of which chrome is active.
 */
export function AppShell({ children, onNewPost, fullWidth }: AppShellProps) {
  // Warm the landing data behind every nav destination once the shell mounts.
  useWarmNavDestinations()
  // Mirror this account's settings to/from data.ovoid.at (no-op when signed out).
  useSettingsSync()
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MobileShell fullWidth={fullWidth}>{children}</MobileShell>
  }

  return (
    <>
      <TopBar onNewPost={onNewPost} />
      <ShellLayout fullWidth={fullWidth}>
        <RouteTransition variant="fade">{children}</RouteTransition>
      </ShellLayout>
      <UserFab />
    </>
  )
}
