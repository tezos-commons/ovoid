import { useQuery, queryOptions } from '@tanstack/react-query'
import {
  AppBskyFeedDefs,
  type Agent,
  type AppBskyActorDefs,
  type AppBskyFeedGetPostThread,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { findCachedFeedItem } from '@/lib/feed-cache'
import { qk } from '@/lib/query-keys'

/**
 * Shared query config for a post thread, consumed by both `useThread` and the
 * visibility prefetcher (so the key + fetcher never drift). `uri` is a full
 * at:// post uri.
 *
 * placeholderData synthesizes a single-node thread (plus the immediate parent
 * when the feed row carried one) from whatever feed cache already holds the
 * post, so tapping a post paints instantly even when the prefetch hasn't
 * landed. It is observer-only — never written to the cache — and ThreadScreen
 * shows a replies skeleton while `isPlaceholderData`.
 */
export function threadOptions(agent: Agent, uri: string) {
  return queryOptions({
    queryKey: qk.thread(uri),
    queryFn: async () => {
      const res = await agent.app.bsky.feed.getPostThread({
        uri,
        depth: 10,
        parentHeight: 80,
      })
      return res.data
    },
    placeholderData: (): AppBskyFeedGetPostThread.OutputSchema | undefined => {
      const item = findCachedFeedItem(uri)
      if (!item) return undefined
      // Both uris here are canonical (same cache), so plain equality is right.
      const parent =
        item.reply &&
        AppBskyFeedDefs.isPostView(item.reply.parent) &&
        item.reply.parent.uri !== item.post.uri
          ? item.reply.parent
          : undefined
      return {
        thread: {
          $type: 'app.bsky.feed.defs#threadViewPost',
          post: item.post,
          ...(parent
            ? { parent: { $type: 'app.bsky.feed.defs#threadViewPost', post: parent } }
            : {}),
        },
      }
    },
  })
}

/**
 * Build the post AT-URI from the route params. getPostThread accepts a handle
 * in the authority position (the AppView resolves it), so we don't need the DID
 * up front. `actor` is whatever the permalink carried (handle or did).
 */
export function buildPostUri(actor: string, rkey: string): string {
  // Already a full at:// uri (defensive — some callers pass one through).
  if (actor.startsWith('at://')) return actor
  return `at://${actor}/app.bsky.feed.post/${rkey}`
}

export type ThreadNode = AppBskyFeedGetPostThread.OutputSchema['thread']

/**
 * getPostThread for a single post. Public-capable: works signed out against the
 * public AppView (no viewer state then). The query is keyed by the post uri only
 * (qk.thread), matching the public, viewer-independent convention and letting
 * optimistic like/repost patches in patchPostInAllFeeds reach the thread cache.
 *
 * depth/parentHeight are pushed near their maxima so the parent chain and the
 * reply subtree arrive in one round trip; the AppView caps them server-side.
 */
export function useThread(actor: string, rkey: string) {
  const { agent } = useAgent()
  const uri = buildPostUri(actor, rkey)
  return useQuery(threadOptions(agent, uri))
}

/**
 * Every distinct account appearing in the thread (focused post + ancestor chain
 * + the full reply subtree), deduped by DID in encounter order. Authors are
 * ProfileViewBasic, which lacks follower counts — ranking by popularity is done
 * separately via useThreadAuthorProfiles.
 */
export function collectThreadAuthors(
  focused: AppBskyFeedDefs.ThreadViewPost,
): AppBskyActorDefs.ProfileViewBasic[] {
  const byDid = new Map<string, AppBskyActorDefs.ProfileViewBasic>()
  const add = (a?: AppBskyActorDefs.ProfileViewBasic) => {
    if (a?.did && !byDid.has(a.did)) byDid.set(a.did, a)
  }

  // Ancestor chain.
  let cur: unknown = focused.parent
  let g = 0
  while (cur && g++ < 200) {
    if (isThreadViewPost(cur)) {
      add(cur.post.author)
      cur = cur.parent
    } else break
  }

  add(focused.post.author)

  // Reply subtree (iterative DFS, guarded against malformed cycles).
  const stack: unknown[] = [...(focused.replies ?? [])]
  let guard = 0
  while (stack.length && guard++ < 5000) {
    const n = stack.pop()
    if (isThreadViewPost(n)) {
      add(n.post.author)
      if (n.replies) stack.push(...n.replies)
    }
  }

  return [...byDid.values()]
}

/**
 * Detailed profiles for a set of DIDs via getProfiles (chunked at the 25-actor
 * server cap), returned as a did -> ProfileViewDetailed map. Supplies both the
 * follower counts used to rank the author grid and the data the badge renders.
 */
export function useThreadAuthorProfiles(dids: string[]) {
  const { agent } = useAgent()
  const sorted = [...dids].sort()
  return useQuery({
    queryKey: qk.profilesBulk(sorted.join(',')),
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const byDid = new Map<string, AppBskyActorDefs.ProfileViewDetailed>()
      for (let i = 0; i < sorted.length; i += 25) {
        const chunk = sorted.slice(i, i + 25)
        const res = await agent.app.bsky.actor.getProfiles({ actors: chunk })
        for (const p of res.data.profiles) byDid.set(p.did, p)
      }
      return byDid
    },
  })
}

/* ---- thread union narrowing helpers ---- */

export function isThreadViewPost(
  node: unknown,
): node is AppBskyFeedDefs.ThreadViewPost {
  return AppBskyFeedDefs.isThreadViewPost(node)
}

export function isNotFoundPost(
  node: unknown,
): node is AppBskyFeedDefs.NotFoundPost {
  return AppBskyFeedDefs.isNotFoundPost(node)
}

export function isBlockedPost(
  node: unknown,
): node is AppBskyFeedDefs.BlockedPost {
  return AppBskyFeedDefs.isBlockedPost(node)
}

/**
 * Flatten the parent chain (oldest ancestor first, immediate parent last).
 * Stops at the first non-threadViewPost (notFound/blocked) ancestor and records
 * it so the UI can render a "post unavailable" stub at the top of the chain.
 */
export function collectParents(
  focused: AppBskyFeedDefs.ThreadViewPost,
): { ancestors: AppBskyFeedDefs.ThreadViewPost[]; brokenTop: boolean } {
  const out: AppBskyFeedDefs.ThreadViewPost[] = []
  let cur: unknown = focused.parent
  let brokenTop = false
  // Guard against pathological cycles in malformed responses.
  let guard = 0
  while (cur && guard++ < 200) {
    if (isThreadViewPost(cur)) {
      out.push(cur)
      cur = cur.parent
    } else {
      brokenTop = true
      break
    }
  }
  out.reverse()
  return { ancestors: out, brokenTop }
}
