import { useInfiniteQuery } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

interface SearchActorsPage {
  actors: AppBskyActorDefs.ProfileView[]
  cursor?: string
}

/**
 * app.bsky.actor.searchActors (full, cursored) as an infinite query — drives the
 * People tab. Disabled on empty term. searchActors paginates (unlike the
 * typeahead variant, which is single-shot and used by the dropdown).
 */
export function useSearchActors(q: string) {
  const { agent } = useAgent()
  const term = q.trim()

  return useInfiniteQuery({
    queryKey: qk.searchActors(term),
    enabled: term.length > 0,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.actor.searchActors({
        q: term,
        limit: 25,
        cursor: pageParam,
      })
      return res.data as SearchActorsPage
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    staleTime: 30_000,
  })
}
