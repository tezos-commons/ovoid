import { lazy, type ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { RootLayout } from './RootLayout'
import { RequireAuth } from './RequireAuth'
import { RequireAccess } from './RequireAccess'
import { RouteErrorBoundary } from './RouteErrorBoundary'

// Instruments data-router navigations as Sentry transactions (pageload + route
// changes), pairing with browserTracingIntegration in instrument.ts.
const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV7(createBrowserRouter)

/**
 * Wrap a React.lazy component as a route element. Suspense is provided by
 * RootLayout, so children only need to resolve to an element here.
 *
 * Feature entry files do not exist yet — feature agents create them at the
 * exact paths below. The dynamic import() specifiers are the contract.
 */
function lazyEl(factory: () => Promise<{ default: ComponentType<unknown> }>) {
  const C = lazy(factory)
  return <C />
}

/** Same as lazyEl but additionally gates the element behind the auth boundary. */
function protectedEl(factory: () => Promise<{ default: ComponentType<unknown> }>) {
  const C = lazy(factory)
  return (
    <RequireAuth>
      <C />
    </RequireAuth>
  )
}

/** Auth + access gated, for protected routes OUTSIDE the shell (studio) — the
 *  shell's own gate lives in RootLayout, so its child routes don't need this. */
function gatedEl(factory: () => Promise<{ default: ComponentType<unknown> }>) {
  const C = lazy(factory)
  return (
    <RequireAuth>
      <RequireAccess>
        <C />
      </RequireAccess>
    </RequireAuth>
  )
}

// ---- Public routes (rendered outside the app shell) ----
const publicRoutes: RouteObject[] = [
  {
    path: '/login',
    element: lazyEl(() => import('@/features/auth/Login')),
  },
  {
    path: '/oauth/callback',
    element: lazyEl(() => import('@/features/auth/Callback')),
  },
  {
    // Wallet-connect onboarding. Requires a session (RequireAuth) but is NOT
    // access-gated — it's where no-access users are sent, so gating it would
    // loop. Top-level (outside RootLayout) so it renders without shell chrome.
    path: '/onboarding',
    element: protectedEl(() => import('@/features/auth/Onboarding')),
  },
  {
    // Group invite landing — public so it resolves the preview before sign-in.
    path: '/group/join/:code',
    element: lazyEl(() => import('@/features/chat/GroupInviteLanding')),
  },
  {
    // Public standard.site reader. Outside the app shell + RequireAuth, so it
    // renders signed out and bypasses the closed-beta (Tezos list) gate.
    path: '/read/:authority/:rkey',
    element: lazyEl(() => import('@/features/read/ReaderScreen')),
  },
  {
    // Public publication index — lists every article in a publication.
    path: '/pub/:did/:collection/:rkey',
    element: lazyEl(() => import('@/features/read/PublicationScreen')),
  },
]

// ---- Shell routes (inside RootLayout / AppShell) ----
const shellRoutes: RouteObject[] = [
  { index: true, element: protectedEl(() => import('@/features/home/HomeScreen')) },

  {
    path: 'profile/:actor/feed/:rkey',
    element: lazyEl(() => import('@/features/feeds/FeedView')),
  },
  {
    path: 'profile/:actor/post/:rkey',
    element: lazyEl(() => import('@/features/thread/ThreadScreen')),
  },
  {
    path: 'profile/:actor/post/:rkey/liked-by',
    element: lazyEl(() => import('@/features/post/PostLikedBy')),
  },
  {
    path: 'profile/:actor/post/:rkey/reposted-by',
    element: lazyEl(() => import('@/features/post/PostRepostedBy')),
  },
  {
    path: 'profile/:actor/post/:rkey/quotes',
    element: lazyEl(() => import('@/features/post/PostQuotes')),
  },
  {
    path: 'profile/:actor/edit',
    element: protectedEl(() => import('@/features/profile/EditProfileModal')),
  },
  {
    path: 'profile/:actor/lists/:rkey',
    element: lazyEl(() => import('@/features/lists/ListDetail')),
  },
  {
    path: 'profile/:actor',
    element: lazyEl(() => import('@/features/profile/ProfileScreen')),
  },

  {
    path: 'notifications',
    element: protectedEl(() => import('@/features/notifications/NotificationsScreen')),
  },

  {
    path: 'messages',
    element: protectedEl(() => import('@/features/chat/ChatScreen')),
  },
  {
    path: 'messages/:convoId',
    element: protectedEl(() => import('@/features/chat/ChatScreen')),
  },
  {
    path: 'messages/:convoId/settings',
    element: protectedEl(() => import('@/features/chat/GroupSettingsScreen')),
  },

  {
    path: 'search',
    element: lazyEl(() => import('@/features/search/SearchScreen')),
  },
  {
    // Standalone Tezos contract view (token collections today). Public — the
    // tzkt/objkt reads need no session, like the profile NFT tabs.
    path: 'contract/:contract',
    element: lazyEl(() => import('@/features/contract/ContractScreen')),
  },
  {
    // Standalone Tezos account view: redirects to the linked Bluesky profile if
    // there is one (tzbsky), else an objkt-identity mini profile. Also public.
    path: 'address/:address',
    element: lazyEl(() => import('@/features/address/AddressScreen')),
  },
  {
    path: 'feeds',
    element: protectedEl(() => import('@/features/feeds/FeedsScreen')),
  },
  {
    path: 'lists',
    element: protectedEl(() => import('@/features/lists/ListsScreen')),
  },
  {
    path: 'saved',
    element: protectedEl(() => import('@/features/saved/SavedScreen')),
  },
  {
    path: 'settings/*',
    element: protectedEl(() => import('@/features/settings/SettingsScreen')),
  },

  { path: '*', element: lazyEl(() => import('./NotFound')) },
]

// ---- Publishing studio (protected, but OUTSIDE the app shell) ----
// Its own full-viewport chrome; the editor is a separate full-screen route. The
// `new` / `edit` routes rank above the dashboard splat, so they win.
const studioRoutes: RouteObject[] = [
  {
    path: '/studio/:subdomain/new',
    element: gatedEl(() => import('@/features/publish/EditorScreen')),
  },
  {
    path: '/studio/:subdomain/edit/:rkey',
    element: gatedEl(() => import('@/features/publish/EditorScreen')),
  },
  {
    path: '/studio/:subdomain/*',
    element: gatedEl(() => import('@/features/publish/StudioDashboard')),
  },
]

export const router = sentryCreateBrowserRouter([
  {
    // Pathless layout route: renders its matched child via the default Outlet,
    // but its errorElement catches errors from EVERY descendant route (a lazy
    // chunk that fails to load, a route render throw) — replacing react-router's
    // default "💿 Hey developer" screen with a hard-reload recovery.
    errorElement: <RouteErrorBoundary />,
    children: [
      ...publicRoutes,
      ...studioRoutes,
      {
        path: '/',
        element: <RootLayout />,
        children: shellRoutes,
      },
    ],
  },
])
