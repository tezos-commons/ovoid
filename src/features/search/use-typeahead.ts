import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Debounce a changing value. Returns the value only after it has been stable for
 * `delay` ms — the invariant the typeahead relies on so a fast typist issues one
 * request per pause, not one per keystroke.
 */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export interface TypeaheadResult {
  actors: AppBskyActorDefs.ProfileViewBasic[]
  isLoading: boolean
  isFetching: boolean
  /** True once the debounced term is long enough that a request is in flight or done. */
  active: boolean
}

/**
 * Fast actor typeahead for the search-box dropdown
 * (app.bsky.actor.searchActorsTypeahead — no cursor, low latency).
 *
 * The query key is intentionally NOT the shared qk.searchActors key: typeahead
 * results are a different shape/lifetime than the People-tab full search and we
 * don't want them to collide or be invalidated together.
 */
export function useTypeahead(raw: string, limit = 8): TypeaheadResult {
  const { agent } = useAgent()
  const term = useDebounced(raw.trim(), 200)
  const active = term.length > 0

  const query = useQuery({
    queryKey: qk.searchTypeahead(term),
    enabled: active,
    queryFn: async () => {
      const res = await agent.app.bsky.actor.searchActorsTypeahead({
        q: term,
        limit,
      })
      return res.data.actors
    },
    staleTime: 10_000,
  })

  return {
    actors: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    active,
  }
}
