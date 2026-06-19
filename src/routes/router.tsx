import { lazy, type ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { RootLayout } from './RootLayout'
import { RequireAuth } from './RequireAuth'

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
    // Group invite landing — public so it resolves the preview before sign-in.
    path: '/group/join/:code',
    element: lazyEl(() => import('@/features/chat/GroupInviteLanding')),
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

export const router = sentryCreateBrowserRouter([
  ...publicRoutes,
  {
    path: '/',
    element: <RootLayout />,
    children: shellRoutes,
  },
])
