import { useInfiniteQuery, useQuery, infiniteQueryOptions } from '@tanstack/react-query'
import type { Agent, AppBskyGraphDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { qk } from '@/lib/query-keys'
import { customFeedOptions } from '@/features/home/use-custom-feed'
import { buildListUri, parseListUri } from './list-uri'
import { isCurate } from './PurposeChip'

export type ListView = AppBskyGraphDefs.ListView
export type ListItemView = AppBskyGraphDefs.ListItemView

/** Shared infinite-query config for a list's header+members (hook + prefetch). */
export function listOptions(agent: Agent, listUri: string) {
  return infiniteQueryOptions({
    queryKey: qk.list(listUri),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      agent.app.bsky.graph
        .getList({ list: listUri, cursor: pageParam, limit: 50 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/**
 * Shared infinite-query config for a curate-list's member feed (hook +
 * prefetch). Thin alias over customFeedOptions so qk.feed(did, uri) has
 * exactly one queryFn definition that can't drift between the home strip and
 * this route.
 */
export function listFeedOptions(agent: Agent, did: string | undefined, listUri: string) {
  return customFeedOptions(agent, did, listUri, 'list')
}

/**
 * Warm the list-detail route from a ListView a card already holds: seed the
 * immutable actor+rkey→uri resolution, prefetch the list header+members, and —
 * for curate lists, which alone have a feed tab — prefetch the member feed.
 */
export function prefetchListFromView(agent: Agent, did: string | undefined, list: ListView) {
  const parsed = parseListUri(list.uri)
  if (!parsed) return
  const actor = list.creator.handle || list.creator.did
  queryClient.setQueryData(qk.listUri(actor, parsed.rkey), list.uri)
  const meta = listOptions(agent, list.uri)
  schedulePrefetch(meta.queryKey, () => queryClient.prefetchInfiniteQuery(meta))
  if (isCurate(list.purpose)) {
    const feed = listFeedOptions(agent, did, list.uri)
    schedulePrefetch(feed.queryKey, () => queryClient.prefetchInfiniteQuery(feed))
  }
}

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
    ...listOptions(agent, listUri ?? ''),
    enabled: !!listUri,
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
  // The key reuses the custom-feed namespace so the feed cache invalidates with
  // other feed reads on account switch; the list URI disambiguates it.
  return useInfiniteQuery({
    ...listFeedOptions(agent, did, listUri ?? ''),
    enabled: !!listUri && enabled,
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
