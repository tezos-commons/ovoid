import type { NavigationType } from 'react-router-dom'

/**
 * The router's most recent navigation type, tracked module-side so non-React
 * code (the QueryClient's default refetchOnMount) can read it.
 *
 * Why: returning to a feed via the back gesture (POP) remounts the route; if the
 * feed query is stale it refetches, an infinite-query refetch replays every page
 * and the virtualizer reflows — yanking the restored scroll position to the top
 * mid-scroll. Suppressing refetch-on-mount for POP fixes that across every feed
 * surface at once. It only affects queries that ALREADY have cached data
 * (refetchOnMount is a no-op for cold queries, which always fetch), so forward
 * navigation still loads fresh and nothing goes unfetched.
 *
 * Set during RootLayout's render (before child routes mount and their query
 * observers subscribe), so the value is current when refetchOnMount is read.
 */
let lastNavigationType: string = 'POP'

export function setLastNavigationType(type: NavigationType): void {
  lastNavigationType = type
}

export function isPopNavigation(): boolean {
  return lastNavigationType === 'POP'
}
