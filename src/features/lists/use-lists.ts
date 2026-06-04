import { useInfiniteQuery, infiniteQueryOptions } from '@tanstack/react-query'
import type { Agent, AppBskyGraphDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/** Shared infinite-query config for an actor's lists (hook + nav prefetch). */
export function listsByActorOptions(agent: Agent, actor: string) {
  return infiniteQueryOptions({
    queryKey: qk.lists(actor),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      agent.app.bsky.graph
        .getLists({ actor, cursor: pageParam, limit: 50 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/**
 * Lists owned by an actor — app.bsky.graph.getLists.
 *
 * Returns curate + moderation lists the actor authored (the index for /lists is
 * the viewer's own actor). Paginated by the opaque cursor; an empty cursor is
 * normalized to undefined so getNextPageParam stops the loop.
 */
export function useLists(actor: string | undefined) {
  const { agent } = useAgent()
  return useInfiniteQuery({
    ...listsByActorOptions(agent, actor ?? ''),
    enabled: !!actor,
  })
}

export type ListView = AppBskyGraphDefs.ListView
