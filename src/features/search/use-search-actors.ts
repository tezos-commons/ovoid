import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import type { Agent, AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

interface SearchActorsPage {
  actors: AppBskyActorDefs.ProfileView[]
  cursor?: string
}

/**
 * app.bsky.actor.searchActors (full, cursored) — drives the People tab and the
 * SearchScreen sibling-tab warmer. `term` must be pre-trimmed. searchActors
 * paginates (unlike the typeahead variant, which is single-shot and used by
 * the dropdown).
 */
export function searchActorsOptions(agent: Agent, term: string) {
  return infiniteQueryOptions({
    queryKey: qk.searchActors(term),
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

/** Disabled on empty term. */
export function useSearchActors(q: string) {
  const { agent } = useAgent()
  const term = q.trim()

  return useInfiniteQuery({
    ...searchActorsOptions(agent, term),
    enabled: term.length > 0,
  })
}
