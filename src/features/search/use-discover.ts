import { useQuery, queryOptions } from '@tanstack/react-query'
import type { Agent, AppBskyActorDefs, AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Discover/empty-state adapter.
 *
 * Everything unstable lives here: app.bsky.unspecced.* (trending topics, popular
 * feed generators) plus app.bsky.actor.getSuggestions. These endpoints change
 * shape without notice and some are not served by the public AppView for
 * signed-out viewers, so each call is wrapped to degrade to [] rather than
 * throw — the empty state must always render something useful.
 *
 * The contract isolates unspecced behind exactly this kind of adapter so the
 * SearchScreen never touches an unstable namespace directly.
 */

export interface TrendingTopic {
  topic: string
  /** Pre-built link target (a /search?q=... path or a feed/topic link). */
  link: string
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

/** Shared query config for trending topics (hook + nav prefetch). */
export function trendingOptions(agent: Agent) {
  return queryOptions({
    queryKey: qk.trending(),
    staleTime: 5 * 60_000,
    queryFn: () =>
      safe<TrendingTopic[]>(async () => {
        // getTrends is the newer endpoint; fall through to getTrendingTopics.
        const api = agent.app.bsky.unspecced as unknown as {
          getTrends?: (i: { limit: number }) => Promise<{ data: { trends: Array<{ topic: string; link?: string }> } }>
          getTrendingTopics?: (i: { limit: number }) => Promise<{ data: { topics: Array<{ topic: string; link?: string }> } }>
        }
        if (api.getTrends) {
          const res = await api.getTrends({ limit: 14 })
          return res.data.trends.map((t) => ({
            topic: t.topic,
            link: t.link ?? `/search?q=${encodeURIComponent(t.topic)}`,
          }))
        }
        if (api.getTrendingTopics) {
          const res = await api.getTrendingTopics({ limit: 14 })
          return res.data.topics.map((t) => ({
            topic: t.topic,
            link: t.link ?? `/search?q=${encodeURIComponent(t.topic)}`,
          }))
        }
        return []
      }, []),
  })
}

/** Shared query config for suggested accounts (hook + nav prefetch). */
export function suggestedActorsOptions(agent: Agent, limit = 8) {
  return queryOptions({
    queryKey: qk.suggestedActors(limit),
    staleTime: 5 * 60_000,
    queryFn: () =>
      safe<AppBskyActorDefs.ProfileView[]>(async () => {
        const res = await agent.app.bsky.actor.getSuggestions({ limit })
        return res.data.actors
      }, []),
  })
}

/** Shared query config for popular custom feeds (hook + nav prefetch). */
export function popularFeedsOptions(agent: Agent, query?: string, limit = 12) {
  const q = query?.trim() || undefined
  return queryOptions({
    queryKey: qk.discoverFeeds(q, limit),
    staleTime: 60_000,
    queryFn: () =>
      safe<AppBskyFeedDefs.GeneratorView[]>(async () => {
        const res = await agent.app.bsky.unspecced.getPopularFeedGenerators({
          query: q,
          limit,
        })
        return res.data.feeds
      }, []),
  })
}

/** Trending search terms for the empty state. unspecced — may 404 on some AppViews. */
export function useTrending() {
  const { agent } = useAgent()
  return useQuery(trendingOptions(agent))
}

/** Suggested accounts to follow for the empty state. */
export function useSuggestedActors(limit = 8) {
  const { agent } = useAgent()
  return useQuery(suggestedActorsOptions(agent, limit))
}

/** Popular custom feeds for the Feeds tab and discover state. unspecced. */
export function usePopularFeeds(query?: string, limit = 12) {
  const { agent } = useAgent()
  return useQuery(popularFeedsOptions(agent, query, limit))
}
