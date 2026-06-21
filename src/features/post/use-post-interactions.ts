import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'
import type {
  Agent,
  AppBskyFeedGetLikes,
  AppBskyFeedGetQuotes,
  AppBskyFeedGetRepostedBy,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

const PAGE_SIZE = 30

/**
 * Resolve a route's actor + rkey to the canonical at:// post uri. getLikes /
 * getRepostedBy / getQuotes require the uri's authority to be a *DID* — a
 * handle-authority uri makes the AppView 500 — so resolve a handle to its DID
 * first (DIDs pass through). Immutable for a given route, so cached forever.
 */
export function postUriOptions(agent: Agent, actor: string, rkey: string) {
  return queryOptions({
    queryKey: qk.postUri(actor, rkey),
    staleTime: Infinity,
    queryFn: async (): Promise<string> => {
      let did = actor
      if (!actor.startsWith('did:')) {
        const res = await agent.com.atproto.identity.resolveHandle({ handle: actor })
        did = res.data.did
      }
      return `at://${did}/app.bsky.feed.post/${rkey}`
    },
  })
}

export function usePostUri(actor: string, rkey: string) {
  const { agent } = useAgent()
  return useQuery(postUriOptions(agent, actor, rkey))
}

/**
 * Accounts who liked a post (getLikes), reposted it (getRepostedBy), and posts
 * quoting it (getQuotes). Each is exposed as an infiniteQueryOptions factory
 * (per the data-layer rules) so a future visibility prefetcher and the live hook
 * share one key + fetcher. `uri` is a full at:// post uri.
 *
 * All three are viewer-dependent — the keys carry `did` — because the rows
 * carry viewer state (follow / like / repost relationships).
 */
export function postLikedByOptions(agent: Agent, did: string | undefined, uri: string) {
  return infiniteQueryOptions({
    queryKey: qk.postLikedBy(did, uri),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<AppBskyFeedGetLikes.OutputSchema> => {
      const res = await agent.app.bsky.feed.getLikes({ uri, limit: PAGE_SIZE, cursor: pageParam })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

export function postRepostedByOptions(agent: Agent, did: string | undefined, uri: string) {
  return infiniteQueryOptions({
    queryKey: qk.postRepostedBy(did, uri),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<AppBskyFeedGetRepostedBy.OutputSchema> => {
      const res = await agent.app.bsky.feed.getRepostedBy({
        uri,
        limit: PAGE_SIZE,
        cursor: pageParam,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

export function postQuotesOptions(agent: Agent, did: string | undefined, uri: string) {
  return infiniteQueryOptions({
    queryKey: qk.postQuotes(did, uri),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<AppBskyFeedGetQuotes.OutputSchema> => {
      const res = await agent.app.bsky.feed.getQuotes({ uri, limit: PAGE_SIZE, cursor: pageParam })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

export function useLikedBy(uri: string | undefined) {
  const { agent, did } = useAgent()
  return useInfiniteQuery({ ...postLikedByOptions(agent, did, uri ?? ''), enabled: !!uri })
}

export function useRepostedBy(uri: string | undefined) {
  const { agent, did } = useAgent()
  return useInfiniteQuery({ ...postRepostedByOptions(agent, did, uri ?? ''), enabled: !!uri })
}

export function useQuotes(uri: string | undefined) {
  const { agent, did } = useAgent()
  return useInfiniteQuery({ ...postQuotesOptions(agent, did, uri ?? ''), enabled: !!uri })
}
