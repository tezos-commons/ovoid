import { useEffect } from 'react'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { runWhenIdle } from '@/lib/idle'
import { useAgent } from '@/lib/api/agent'
import { timelineOptions } from '@/features/home/use-timeline'
import {
  trendingOptions,
  suggestedActorsOptions,
  popularFeedsOptions,
} from '@/features/search/use-discover'
import { convosOptions } from '@/features/chat/use-convos'
import { notificationsOptions } from '@/features/notifications/use-notifications'
import { myFeedsOptions } from '@/features/feeds/use-my-feeds'
import { listsByActorOptions } from '@/features/lists/use-lists'
import { profileOptions } from '@/features/profile/use-profile'
import { authorFeedOptions } from '@/features/profile/use-author-feed'
import { prefetchBookmarks } from '@/features/saved/use-bookmarks'
import { savedFeedsOptions } from '@/features/saved/use-saved-feeds'

type PrefetchQuery = Parameters<typeof queryClient.prefetchQuery>[0]
type PrefetchInfinite = Parameters<typeof queryClient.prefetchInfiniteQuery>[0]

function warmQuery(opts: { queryKey: readonly unknown[] }) {
  schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts as PrefetchQuery))
}
function warmInfinite(opts: { queryKey: readonly unknown[] }) {
  schedulePrefetch(opts.queryKey, () =>
    queryClient.prefetchInfiniteQuery(opts as PrefetchInfinite),
  )
}

/**
 * Warm the landing query behind every primary nav destination, so the first tap
 * of Search / Messages / Notifications / Feeds / Lists / Profile renders from
 * cache instead of a cold fetch. The nav is always on screen, so this applies
 * the "link visible → prefetch" rule to the whole nav at once. Runs on idle and
 * is concurrency-bounded; `staleTime` makes each warm a no-op when already
 * fresh, so it self-limits across navigations.
 *
 * Not warmed: the search typeahead (type-gated) — it still loads on first use.
 */
export function useWarmNavDestinations() {
  const { agent, chatAgent, did, isAuthed } = useAgent()
  useEffect(() => {
    if (!isAuthed || !did) return
    return runWhenIdle(() => {
      warmInfinite(timelineOptions(agent, did)) // Home
      warmQuery(trendingOptions(agent)) // Search (discover trio)
      warmQuery(suggestedActorsOptions(agent, 6))
      warmQuery(popularFeedsOptions(agent, undefined, 6))
      if (chatAgent) warmInfinite(convosOptions(chatAgent, did)) // Messages
      warmInfinite(notificationsOptions(agent, did)) // Notifications
      warmQuery(myFeedsOptions(agent, did)) // Feeds
      warmInfinite(listsByActorOptions(agent, did)) // Lists
      warmQuery(profileOptions(agent, did)) // Profile (own)
      warmInfinite(authorFeedOptions(agent, did, did, 'posts_no_replies'))
      prefetchBookmarks(agent, did) // Saved (landing: bookmarks tab)
      warmQuery(savedFeedsOptions(agent, did)) // Saved (sibling feeds tab)
    })
  }, [agent, chatAgent, did, isAuthed])
}
