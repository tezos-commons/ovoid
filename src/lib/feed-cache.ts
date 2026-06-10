import { AppBskyFeedDefs, type AppBskyActorDefs } from '@atproto/api'
import { queryClient } from './query-client'
import { qk } from './query-keys'

/**
 * Read-only scans over the cached feed pages, used to synthesize placeholderData
 * for the thread and profile screens: data the user is navigating *from* paints
 * the destination instantly, while the real fetch fills in what a feed item
 * can't carry (replies, counts, banner).
 *
 * The scan is bounded — feed caches are capped by MAX_FEED_PAGES and evicted at
 * gcTime — and runs only when an observer mounts without data, so it's cheap
 * relative to the network round-trip it papers over.
 */

type FeedItem = AppBskyFeedDefs.FeedViewPost
type FeedPage = { feed?: FeedItem[] }
type InfiniteShape = { pages?: FeedPage[] }

function cachedFeedEntries(): Array<[readonly unknown[], InfiniteShape | undefined]> {
  return queryClient.getQueriesData<InfiniteShape>({
    predicate: (q) => qk.isFeedKey(q.queryKey),
  })
}

/**
 * Does `post` denote the post addressed by `uri`? Cached PostViews carry the
 * canonical DID-authority at-uri, but thread queries are keyed by the uri built
 * from the permalink, whose authority is the author's HANDLE when one exists —
 * so equality must accept either authority form for the same rkey.
 */
function postMatchesUri(post: AppBskyFeedDefs.PostView, uri: string): boolean {
  if (post.uri === uri) return true
  const m = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(uri)
  if (!m) return false
  const [, authority, rkey] = m
  return (
    post.uri.endsWith(`/app.bsky.feed.post/${rkey}`) &&
    (post.author.did === authority || post.author.handle === authority)
  )
}

/**
 * Find a post anywhere in the cached feeds. The reply context shown above a
 * reply row (parent/root) is tappable too, so those PostViews match as well —
 * wrapped as a bare item (no reply context of their own).
 */
export function findCachedFeedItem(uri: string): FeedItem | undefined {
  for (const [, data] of cachedFeedEntries()) {
    for (const page of data?.pages ?? []) {
      for (const item of page.feed ?? []) {
        if (postMatchesUri(item.post, uri)) return item
        const parent = item.reply?.parent
        if (AppBskyFeedDefs.isPostView(parent) && postMatchesUri(parent, uri)) {
          return { post: parent }
        }
        const root = item.reply?.root
        if (AppBskyFeedDefs.isPostView(root) && postMatchesUri(root, uri)) {
          return { post: root }
        }
      }
    }
  }
  return undefined
}

/**
 * Find any embedded profile of `actor` (handle or DID) in the cached feeds.
 * Feed authors are ProfileViewBasic — a structural subset of ProfileViewDetailed
 * (counts/banner/description are optional there), and they carry viewer state,
 * so a placeholder built from one renders name, avatar and follow state.
 */
export function findCachedProfileBasic(
  actor: string,
): AppBskyActorDefs.ProfileViewBasic | undefined {
  const matches = (a: AppBskyActorDefs.ProfileViewBasic | undefined) =>
    !!a && (a.did === actor || a.handle === actor)
  for (const [, data] of cachedFeedEntries()) {
    for (const page of data?.pages ?? []) {
      for (const item of page.feed ?? []) {
        if (matches(item.post.author)) return item.post.author
        const parent = item.reply?.parent
        if (AppBskyFeedDefs.isPostView(parent) && matches(parent.author)) return parent.author
        const root = item.reply?.root
        if (AppBskyFeedDefs.isPostView(root) && matches(root.author)) return root.author
      }
    }
  }
  return undefined
}
