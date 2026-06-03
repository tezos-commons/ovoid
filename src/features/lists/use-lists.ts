import { useInfiniteQuery } from '@tanstack/react-query'
import type { AppBskyGraphDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

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
    queryKey: qk.lists(actor ?? ''),
    enabled: !!actor,
    queryFn: ({ pageParam }) =>
      agent.app.bsky.graph
        .getLists({ actor: actor!, cursor: pageParam, limit: 50 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

export type ListView = AppBskyGraphDefs.ListView
