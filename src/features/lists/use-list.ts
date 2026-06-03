import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { AppBskyGraphDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { buildListUri } from './list-uri'

export type ListView = AppBskyGraphDefs.ListView
export type ListItemView = AppBskyGraphDefs.ListItemView

/**
 * Resolve a route (actor, rkey) to the list's AT-URI.
 *
 * getList's `list` param must be an AT-URI whose authority is the creator's
 * *DID* — a handle authority yields "List not found". Route actors may be
 * handles, so resolve to a DID first (DIDs pass through). Cached forever since
 * actor->did + rkey is immutable for a given route.
 */
export function useListUri(actor: string | undefined, rkey: string | undefined) {
  const { agent } = useAgent()
  return useQuery({
    queryKey: qk.listUri(actor ?? '', rkey ?? ''),
    enabled: !!actor && !!rkey,
    staleTime: Infinity,
    queryFn: async () => {
      let did = actor!
      if (!did.startsWith('did:')) {
        const res = await agent.com.atproto.identity.resolveHandle({ handle: did })
        did = res.data.did
      }
      return buildListUri(did, rkey!)
    },
  })
}

export const CURATE = 'app.bsky.graph.defs#curatelist'
export const MODLIST = 'app.bsky.graph.defs#modlist'
export const REFERENCE = 'app.bsky.graph.defs#referencelist'

/**
 * A list's metadata + its members — app.bsky.graph.getList.
 *
 * getList returns the ListView header on every page (we read it off page 0) and
 * a page of ListItemView members. We paginate members with useInfiniteQuery; the
 * header is stable so consumers read `data.pages[0].list`.
 */
export function useList(listUri: string | undefined) {
  const { agent } = useAgent()
  return useInfiniteQuery({
    queryKey: qk.list(listUri ?? ''),
    enabled: !!listUri,
    queryFn: ({ pageParam }) =>
      agent.app.bsky.graph
        .getList({ list: listUri!, cursor: pageParam, limit: 50 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/**
 * Feed of posts from a curate-list's members — app.bsky.feed.getListFeed.
 *
 * Only meaningful for curatelist purpose; mod lists have no feed. Callers gate on
 * the list purpose before mounting this.
 */
export function useListFeed(listUri: string | undefined, enabled = true) {
  const { agent, did } = useAgent()
  return useInfiniteQuery({
    // Reuse the custom-feed key namespace so the feed cache is invalidated with
    // other feed reads on account switch; the list URI disambiguates it.
    queryKey: qk.feed(did, listUri ?? ''),
    enabled: !!listUri && enabled,
    queryFn: ({ pageParam }) =>
      agent.app.bsky.feed
        .getListFeed({ list: listUri!, cursor: pageParam, limit: 30 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/**
 * Light single-shot fetch of just the list header (used when we need the purpose
 * to decide whether to show the feed tab without paging members). Falls back to
 * the first members page under the hood.
 */
export function useListHeader(listUri: string | undefined) {
  const { agent } = useAgent()
  return useQuery({
    queryKey: [...qk.list(listUri ?? ''), 'header'],
    enabled: !!listUri,
    queryFn: () =>
      agent.app.bsky.graph
        .getList({ list: listUri!, limit: 1 })
        .then((r) => r.data.list),
  })
}
