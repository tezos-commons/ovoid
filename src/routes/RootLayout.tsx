import { Suspense, lazy, useEffect } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Spinner, Lightbox } from '@/components'
import { useComposer, useComposerStore } from '@/store/compose-store'
import { useChatStore } from '@/store/chat-store'
import { useNftBrowserStore } from '@/store/nft-browser-store'
import { useArtifactStore } from '@/store/artifact-store'
import { PostActionsBridge } from '@/features/post/PostActionsBridge'
import { RequireAuth } from './RequireAuth'
import { RequireAccess } from './RequireAccess'
import { usePushBoot } from '@/features/notifications/use-push-boot'
import { useEscapeBack } from '@/lib/use-escape-back'
import { useGlobalShortcuts } from '@/lib/use-global-shortcuts'
import { CommandPalette } from '@/components/CommandPalette'
import { ShortcutsDialog } from '@/components/ShortcutsDialog'
import { useAgent } from '@/lib/api/agent'
import { setLastAccount } from '@/features/auth/last-account'

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
const FULL_WIDTH_PREFIXES = ['/messages', '/search']

export function RootLayout() {
  const { openCompose } = useComposer()
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const fullWidth = FULL_WIDTH_PREFIXES.some((p) => pathname.startsWith(p))

  // Reset document scroll to the top on forward (PUSH/REPLACE) navigation, so a
  // newly opened screen — a profile tapped from a scrolled feed, a thread — does
  // not inherit the previous route's scroll offset. POP (back/forward) is left
  // alone so per-screen scroll restoration (useWindowScrollRestoration,
  // InfiniteList) can restore the remembered position. The whole app scrolls the
  // window (useWindowVirtualizer), so window is the right target. /messages owns
  // its own internal scroll and starts at the list, so excluding it is moot.
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navigationType])

  const composeOpen = useComposerStore((s) => s.open)
  const newChatOpen = useChatStore((s) => s.newChatOpen)
  const nftOpen = useNftBrowserStore((s) => s.open)
  // The player stays mounted through mini ⇄ full so audio survives; it only
  // unmounts (stopping playback) when explicitly closed.
  const artifactMode = useArtifactStore((s) => s.mode)

  // Desktop: ESC steps back through overlay layers (mirrors back-swipe).
  useEscapeBack()

  // App-wide keyboard shortcuts (⌘K palette, ? help, n compose, g-chord nav).
  useGlobalShortcuts()

  // Push glue: notificationclick → in-app navigation, icon badge, sub re-sync.
  usePushBoot()

  // Remember the signed-in account (handle/avatar hydrate after sign-in) so the
  // login screen can offer it back after sign-out. Kept across logout on purpose.
  const { isAuthed, did, handle, avatar } = useAgent()
  useEffect(() => {
    if (isAuthed && did && handle) setLastAccount({ did, handle, avatar })
  }, [isAuthed, did, handle, avatar])

  // The entire shell is gated: a session is required (RequireAuth → /login),
  // then access (RequireAccess → /onboarding when not on the list and no wallet).
  // Gating here, above AppShell, means a no-access user never sees the nav chrome
  // before the redirect. /onboarding and /login are top-level routes outside this
  // layout, so they're never caught by these boundaries (no redirect loop).
  return (
    <RequireAuth>
      <RequireAccess>
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
          <CommandPalette />
          <ShortcutsDialog />
        </PostActionsBridge>
      </RequireAccess>
    </RequireAuth>
  )
}

export default RootLayout
