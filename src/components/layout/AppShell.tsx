import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { BottomTabBar } from './BottomTabBar'
import { ComposeFab } from './ComposeFab'
import { UserFab } from './UserFab'
import { ShellLayout } from './PageLayout'
import { useWarmNavDestinations } from '@/features/prefetch-routes'
import './layout.css'

export interface AppShellProps {
  children: ReactNode
  /** Open the global compose modal (wired by RootLayout). */
  onNewPost?: () => void
  /** Route-decided full-width page area (no reserved aside). See ShellLayout. */
  fullWidth?: boolean
}

/**
 * App shell: a sticky top bar holding the primary nav, above a two-column page
 * area (a page-specific left aside filled via <PageAside>, plus flexible main
 * content). Below the mobile breakpoint the top bar hides in favor of the
 * BottomTabBar and the columns stack (see layout.css).
 */
export function AppShell({ children, onNewPost, fullWidth }: AppShellProps) {
  // Warm the landing data behind every nav destination once the shell mounts.
  useWarmNavDestinations()
  return (
    <>
      <TopBar onNewPost={onNewPost} />
      <ShellLayout fullWidth={fullWidth}>{children}</ShellLayout>
      <UserFab />
      <ComposeFab onNewPost={onNewPost} />
      <BottomTabBar />
    </>
  )
}
