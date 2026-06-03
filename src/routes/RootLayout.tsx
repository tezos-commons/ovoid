import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Spinner, Lightbox } from '@/components'
import { useComposer } from '@/store/compose-store'
import { PostActionsBridge } from '@/features/post/PostActionsBridge'
import { ComposeModal } from '@/features/home/compose/ComposeModal'
import { NftBrowser } from '@/components/embeds/NftBrowser'
import { ArtifactPlayer } from '@/components/embeds/ArtifactPlayer'
import { useEscapeBack } from '@/lib/use-escape-back'

/**
 * Top-level layout shared by every screen. Hosts the AppShell, a Suspense
 * boundary for lazy route modules, the single globally-mounted compose modal,
 * and the PostActionsBridge that makes every PostCard interactive (like /
 * repost / reply / quote / share) regardless of which screen renders it.
 */
/** Routes that use a full-width page area (no reserved aside). Decided here so
 * the width is correct during the lazy screen's Suspense fallback (no jump). */
const FULL_WIDTH_PREFIXES = ['/messages']

export function RootLayout() {
  const { openCompose } = useComposer()
  const { pathname } = useLocation()
  const fullWidth = FULL_WIDTH_PREFIXES.some((p) => pathname.startsWith(p))

  // Desktop: ESC steps back through overlay layers (mirrors back-swipe).
  useEscapeBack()

  return (
    <PostActionsBridge>
      <AppShell onNewPost={openCompose} fullWidth={fullWidth}>
        <Suspense
          fallback={
            <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
              <Spinner size="lg" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </AppShell>
      <ComposeModal />
      <NftBrowser />
      <ArtifactPlayer />
      <Lightbox />
    </PostActionsBridge>
  )
}

export default RootLayout
