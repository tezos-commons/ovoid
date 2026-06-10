import type { QueryClient } from '@tanstack/react-query'
import type { AppBskyFeedDefs } from '@atproto/api'

export type PostPatcher = (post: AppBskyFeedDefs.PostView) => AppBskyFeedDefs.PostView

/** Patcher for a new reply landing under `post` (feeds show the count only). */
export const bumpReplyCount: PostPatcher = (post) => ({
  ...post,
  replyCount: (post.replyCount ?? 0) + 1,
})

type FeedItem = { post?: AppBskyFeedDefs.PostView; reply?: unknown; reason?: unknown }
type FeedPage = { feed?: FeedItem[]; cursor?: string }
type InfiniteShape = { pages?: FeedPage[]; pageParams?: unknown[] }

function sameUri(post: AppBskyFeedDefs.PostView | undefined, uri: string): boolean {
  return !!post && post.uri === uri
}

/**
 * Immutably patch a post wherever it appears in cached feeds and threads.
 *
 * Invariant: structural sharing — only the page/item/post on the matching uri
 * is reallocated; all other references are preserved so React Query / the
 * virtualizer don't see spurious changes (no scroll jitter). Callers must NOT
 * also invalidate the patched feed onSettled.
 *
 * Scans every query whose key is prefixed ['bsky', did, 'feed', ...] plus the
 * thread cache ['bsky','thread',...].
 */
export function patchPostInAllFeeds(
  qc: QueryClient,
  did: string | undefined,
  postUri: string,
  patch: PostPatcher,
): void {
  // Infinite feed caches (timeline, custom, author, likes).
  qc.setQueriesData<InfiniteShape>({ queryKey: ['bsky', did, 'feed'] }, (data) =>
    patchInfinite(data, postUri, patch),
  )

  // Thread cache is public-keyed (no did).
  qc.setQueriesData<unknown>({ queryKey: ['bsky', 'thread'] }, (data: unknown) =>
    patchThread(data, postUri, patch),
  )
}

function patchInfinite(
  data: InfiniteShape | undefined,
  uri: string,
  patch: PostPatcher,
): InfiniteShape | undefined {
  if (!data?.pages) return data
  let pagesChanged = false
  const pages = data.pages.map((page) => {
    if (!page.feed) return page
    let itemsChanged = false
    const feed = page.feed.map((item) => {
      if (sameUri(item.post, uri)) {
        itemsChanged = true
        return { ...item, post: patch(item.post as AppBskyFeedDefs.PostView) }
      }
      return item
    })
    if (!itemsChanged) return page
    pagesChanged = true
    return { ...page, feed }
  })
  return pagesChanged ? { ...data, pages } : data
}

/** Recursively patch a getPostThread response (threadViewPost tree). */
function patchThread(node: unknown, uri: string, patch: PostPatcher): unknown {
  if (!node || typeof node !== 'object') return node

  // Top-level response wrapper { thread: ... }
  if ('thread' in node) {
    const wrapper = node as { thread: unknown }
    const next = patchThread(wrapper.thread, uri, patch)
    return next === wrapper.thread ? node : { ...wrapper, thread: next }
  }

  const tv = node as {
    post?: AppBskyFeedDefs.PostView
    parent?: unknown
    replies?: unknown[]
  }

  let changed = false
  let post = tv.post
  if (sameUri(tv.post, uri)) {
    post = patch(tv.post as AppBskyFeedDefs.PostView)
    changed = true
  }

  const parent = tv.parent ? patchThread(tv.parent, uri, patch) : tv.parent
  if (parent !== tv.parent) changed = true

  let replies = tv.replies
  if (Array.isArray(tv.replies)) {
    const mapped = tv.replies.map((r) => patchThread(r, uri, patch))
    if (mapped.some((r, i) => r !== (tv.replies as unknown[])[i])) {
      replies = mapped
      changed = true
    }
  }

  return changed ? { ...tv, post, parent, replies } : node
}
