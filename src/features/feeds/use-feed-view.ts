import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { Agent, AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type GeneratorView = AppBskyFeedDefs.GeneratorView
type FeedViewPost = AppBskyFeedDefs.FeedViewPost

/**
 * Build the generator AT-URI from the route's actor + rkey.
 *
 * The `feed` param of getFeed/getFeedGenerator must be a fully-qualified AT-URI
 * whose authority is the *DID* of the creator. A route actor may be a handle,
 * which is not a valid AT-URI authority, so we resolve it to a DID first (and
 * pass DIDs through untouched).
 */
async function resolveGeneratorUri(
  agent: Agent,
  actor: string,
  rkey: string,
): Promise<string> {
  let did = actor
  if (!actor.startsWith('did:')) {
    const res = await agent.com.atproto.identity.resolveHandle({
      handle: actor,
    })
    did = res.data.did
  }
  return `at://${did}/app.bsky.feed.generator/${rkey}`
}

/** Resolve actor+rkey to the generator AT-URI (cached, public-capable). */
export function useGeneratorUri(actor: string, rkey: string) {
  const { agent } = useAgent()
  return useQuery({
    queryKey: qk.feedGeneratorUri(actor, rkey),
    queryFn: () => resolveGeneratorUri(agent, actor, rkey),
    staleTime: Infinity, // actor->did + rkey is immutable for a given route
  })
}

/** Single feed generator metadata (name, creator, description, like state). */
export function useFeedGenerator(uri: string | undefined) {
  const { agent } = useAgent()
  return useQuery<GeneratorView>({
    queryKey: qk.feedGenerator(uri ?? ''),
    enabled: !!uri,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await agent.app.bsky.feed.getFeedGenerator({ feed: uri! })
      return res.data.view
    },
  })
}

/** The posts produced by a feed generator (infinite, viewer-scoped cache). */
export function useFeedPosts(uri: string | undefined) {
  const { agent, did } = useAgent()
  return useInfiniteQuery({
    queryKey: qk.feed(did, uri ?? ''),
    enabled: !!uri,
    queryFn: ({ pageParam }) =>
      agent.app.bsky.feed
        .getFeed({ feed: uri!, cursor: pageParam, limit: 30 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
    staleTime: 30_000,
  })
}

/** Flatten the infinite pages into a single FeedViewPost[] for the list. */
export function flattenFeed(
  pages: { feed: FeedViewPost[] }[] | undefined,
): FeedViewPost[] {
  return pages?.flatMap((p) => p.feed) ?? []
}

/**
 * Like / unlike a feed generator (the heart shown on feed cards / header).
 *
 * agent.like(uri, cid) creates an app.bsky.feed.like whose subject is the
 * generator record; deleteLike(likeUri) removes it. The undo needs the like
 * record's own URI (from viewer.like), not the generator URI. We invalidate the
 * generator metadata afterward so likeCount + viewer.like reconcile.
 */
export function useFeedLike(uri: string | undefined) {
  const { agent } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cid,
      likeUri,
    }: {
      cid: string
      likeUri?: string
    }) => {
      if (!uri) throw new Error('no feed uri')
      if (likeUri) {
        await agent.deleteLike(likeUri)
      } else {
        await agent.like(uri, cid)
      }
    },
    onSettled: () => {
      if (uri) qc.invalidateQueries({ queryKey: qk.feedGenerator(uri) })
    },
  })
}
