import { Suspense, lazy } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Spinner, Lightbox } from '@/components'
import { useComposer, useComposerStore } from '@/store/compose-store'
import { useChatStore } from '@/store/chat-store'
import { useNftBrowserStore } from '@/store/nft-browser-store'
import { useArtifactStore } from '@/store/artifact-store'
import { PostActionsBridge } from '@/features/post/PostActionsBridge'
import { useEscapeBack } from '@/lib/use-escape-back'

// Interaction-gated overlays. Code-split AND conditionally mounted: a lazy
// component that always renders (even returning null) still loads its chunk at
// startup, so the store flag gates the mount and the import fires on first use.
// This keeps the composer and the NFT/objkt graph out of the entry bundle.
const ComposeModal = lazy(() =>
  import('@/features/home/compose/ComposeModal').then((m) => ({ default: m.ComposeModal })),
)
const NewChatDialog = lazy(() =>
  import('@/features/chat/NewChatDialog').then((m) => ({ default: m.NewChatDialog })),
)
const NftBrowser = lazy(() =>
  import('@/components/embeds/NftBrowser').then((m) => ({ default: m.NftBrowser })),
)
const ArtifactPlayer = lazy(() =>
  import('@/components/embeds/ArtifactPlayer').then((m) => ({ default: m.ArtifactPlayer })),
)

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

  const composeOpen = useComposerStore((s) => s.open)
  const newChatOpen = useChatStore((s) => s.newChatOpen)
  const nftOpen = useNftBrowserStore((s) => s.open)
  // The player stays mounted through mini ⇄ full so audio survives; it only
  // unmounts (stopping playback) when explicitly closed.
  const artifactMode = useArtifactStore((s) => s.mode)

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
      <Suspense fallback={null}>
        {composeOpen && <ComposeModal />}
        {newChatOpen && <NewChatDialog />}
        {nftOpen && <NftBrowser />}
        {artifactMode !== 'closed' && <ArtifactPlayer />}
      </Suspense>
      <Lightbox />
    </PostActionsBridge>
  )
}

export default RootLayout
