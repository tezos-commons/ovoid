import { useQuery } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { queryClient } from '@/lib/query-client'
import { qk } from '@/lib/query-keys'
import type { HomeTab } from './use-pinned-feeds'

// Staleness threshold + head-poll cadence: the refresh affordance appears once
// the cached feed is older than this and a newer head exists.
const FRESH_MS = 25_000

/** Newest post uri of a feed's first page (cheap head check, limit 1). */
async function fetchHeadUri(agent: Agent, tab: HomeTab): Promise<string | null> {
  if (tab.kind === 'following') {
    const res = await agent.app.bsky.feed.getTimeline({ limit: 1 })
    return res.data.feed[0]?.post?.uri ?? null
  }
  const res =
    tab.kind === 'list'
      ? await agent.app.bsky.feed.getListFeed({ list: tab.value, limit: 1 })
      : await agent.app.bsky.feed.getFeed({ feed: tab.value, limit: 1 })
  return res.data.feed[0]?.post?.uri ?? null
}

/** The cached feed's query key (matches use-timeline / use-custom-feed). */
function feedKeyFor(did: string | undefined, tab: HomeTab) {
  return tab.kind === 'following' ? qk.timeline(did) : qk.feed(did, tab.value)
}

/**
 * Detect whether a newer version of the *active* feed is available, and provide a
 * reload action — without ever auto-refetching the feed under the user. A small
 * head poll (limit 1, every ~25s + on focus) compares the newest post uri to the
 * one on screen; `hasNew` is true only once the cached feed is also older than
 * FRESH_MS. `refresh()` reloads the feed from the top.
 */
export function useFeedRefresh(params: {
  agent: Agent
  did: string | undefined
  tab: HomeTab | undefined
  enabled: boolean
  visibleTopUri: string | undefined
  dataUpdatedAt: number
}): { hasNew: boolean; refresh: () => void } {
  const { agent, did, tab, enabled, visibleTopUri, dataUpdatedAt } = params

  // Kept off the ['bsky', did, 'feed', …] prefix so feed-wide cache ops never
  // touch this scalar head value.
  const headKey = ['bsky', did, 'feed-head', { feed: tab ? tab.value : 'none' }] as const

  const head = useQuery({
    queryKey: headKey,
    enabled: enabled && !!tab,
    queryFn: () => fetchHeadUri(agent, tab!),
    refetchInterval: FRESH_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: FRESH_MS - 5_000,
  })

  const hasNew =
    !!head.data &&
    !!visibleTopUri &&
    head.data !== visibleTopUri &&
    Date.now() - dataUpdatedAt > FRESH_MS

  const refresh = () => {
    if (!tab) return
    window.scrollTo({ top: 0 })
    // Reload the feed from the top (drops stale pages) and re-check the head.
    queryClient.resetQueries({ queryKey: feedKeyFor(did, tab), exact: true })
    queryClient.invalidateQueries({ queryKey: headKey, exact: true })
  }

  return { hasNew, refresh }
}
