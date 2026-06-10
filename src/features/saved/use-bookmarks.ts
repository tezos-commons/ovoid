import { useMemo } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
} from '@tanstack/react-query'
import type { Agent, AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { qk } from '@/lib/query-keys'
import {
  addLocalBookmark,
  listLocalBookmarks,
  removeLocalBookmark,
  type LocalBookmark,
} from './local-bookmarks'

/**
 * A single bookmark entry, normalized to a post view. The native lexicon wraps
 * the post under one of a few field names across builds (`subject` in the
 * published lexicon, `post`/`item` in some intermediates); we accept any of
 * them and expose the flat PostView the UI renders.
 */
export interface BookmarkEntry {
  post: AppBskyFeedDefs.PostView
}

/** Page shape for the bookmark infinite query (native path). */
interface BookmarkPage {
  bookmarks: BookmarkEntry[]
  cursor?: string
}

const PAGE_LIMIT = 50

/* ------------------------------------------------------------------ *
 * Native-API capability detection.
 *
 * `agent.app.bsky.bookmark.getBookmarks` only exists when the SDK build and
 * the connected AppView both ship the bookmark lexicon. We treat its absence
 * as "fall back to client-only localStorage", not an error.
 * ------------------------------------------------------------------ */
type BookmarkNs = {
  getBookmarks?: (params: {
    limit?: number
    cursor?: string
  }) => Promise<{ data: { bookmarks?: unknown[]; cursor?: string } }>
  createBookmark?: (input: { uri: string; cid: string }) => Promise<unknown>
  deleteBookmark?: (input: { uri: string }) => Promise<unknown>
}

function bookmarkNs(agent: Agent): BookmarkNs | undefined {
  // The generated client nests namespaces on agent.app.bsky.*; guard each hop.
  const app = (agent as unknown as { app?: { bsky?: { bookmark?: BookmarkNs } } }).app
  return app?.bsky?.bookmark
}

export function hasNativeBookmarks(agent: Agent): boolean {
  const ns = bookmarkNs(agent)
  return typeof ns?.getBookmarks === 'function'
}

/** Pull the embedded PostView out of whatever field the lexicon used. */
function extractPost(raw: unknown): AppBskyFeedDefs.PostView | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const candidate = r.subject ?? r.post ?? r.item ?? r.value
  if (candidate && typeof candidate === 'object' && 'uri' in (candidate as object)) {
    return candidate as AppBskyFeedDefs.PostView
  }
  // Some shapes are themselves the post view.
  if ('uri' in r && 'author' in r) return raw as AppBskyFeedDefs.PostView
  return null
}

/* ================================================================== *
 * Read: bookmarks list.
 *
 * Native path → useInfiniteQuery over getBookmarks (cursor paginated).
 * Fallback path → a single useQuery that reads localStorage refs and
 *   hydrates them with getPosts (batched, 25 max per call). Returned in the
 *   same InfiniteData shape so the consumer code is uniform.
 * ================================================================== */

/** Shared infinite-query config for native bookmarks (hook + nav prefetch). */
export function nativeBookmarksOptions(agent: Agent, did: string | undefined) {
  return infiniteQueryOptions({
    queryKey: [...qk.bookmarks(did), 'native'] as const,
    queryFn: async ({ pageParam }): Promise<BookmarkPage> => {
      const ns = bookmarkNs(agent)!
      const res = await ns.getBookmarks!({ limit: PAGE_LIMIT, cursor: pageParam })
      const raw = res.data.bookmarks ?? []
      const bookmarks: BookmarkEntry[] = []
      for (const item of raw) {
        const post = extractPost(item)
        if (post) bookmarks.push({ post })
      }
      return { bookmarks, cursor: res.data.cursor || undefined }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/** Shared query config for localStorage-fallback bookmarks (hook + nav prefetch). */
export function localBookmarksOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: [...qk.bookmarks(did), 'local'] as const,
    queryFn: async (): Promise<BookmarkPage> => {
      const refs = listLocalBookmarks(did)
      const posts = await hydratePosts(agent, refs)
      // Preserve local savedAt order; drop refs whose post 404'd / was deleted.
      const byUri = new Map(posts.map((p) => [p.uri, p]))
      const bookmarks: BookmarkEntry[] = refs
        .map((r) => byUri.get(r.uri))
        .filter((p): p is AppBskyFeedDefs.PostView => !!p)
        .map((post) => ({ post }))
      return { bookmarks, cursor: undefined }
    },
  })
}

/**
 * Warm whichever bookmarks read /saved's landing tab will perform. The
 * native-vs-local branch is synchronous on the agent, so the prefetcher can
 * take exactly the path the hook will.
 */
export function prefetchBookmarks(agent: Agent, did: string | undefined): void {
  if (hasNativeBookmarks(agent)) {
    const opts = nativeBookmarksOptions(agent, did)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchInfiniteQuery(opts))
  } else {
    const opts = localBookmarksOptions(agent, did)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
  }
}

export function useBookmarks() {
  const { agent, did, isAuthed } = useAgent()
  const native = hasNativeBookmarks(agent)

  const nativeQuery = useInfiniteQuery({
    ...nativeBookmarksOptions(agent, did),
    enabled: isAuthed && native,
  })

  const fallbackQuery = useQuery({
    ...localBookmarksOptions(agent, did),
    enabled: isAuthed && !native,
  })

  // Normalize both into the same { pages, hasNextPage, ... } surface.
  if (native) {
    return {
      mode: 'native' as const,
      entries: flattenPages(nativeQuery.data),
      isLoading: nativeQuery.isLoading,
      isError: nativeQuery.isError,
      error: nativeQuery.error,
      refetch: nativeQuery.refetch,
      hasNextPage: nativeQuery.hasNextPage,
      isFetchingNextPage: nativeQuery.isFetchingNextPage,
      fetchNextPage: nativeQuery.fetchNextPage,
    }
  }
  return {
    mode: 'local' as const,
    entries: fallbackQuery.data?.bookmarks ?? [],
    isLoading: fallbackQuery.isLoading,
    isError: fallbackQuery.isError,
    error: fallbackQuery.error,
    refetch: fallbackQuery.refetch,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
  }
}

function flattenPages(
  data: InfiniteData<BookmarkPage> | undefined,
): BookmarkEntry[] {
  return data?.pages.flatMap((p) => p.bookmarks) ?? []
}

/** Batch getPosts in chunks of 25 (the lexicon cap). */
async function hydratePosts(
  agent: Agent,
  refs: LocalBookmark[],
): Promise<AppBskyFeedDefs.PostView[]> {
  const uris = refs.map((r) => r.uri)
  const out: AppBskyFeedDefs.PostView[] = []
  for (let i = 0; i < uris.length; i += 25) {
    const chunk = uris.slice(i, i + 25)
    if (chunk.length === 0) continue
    try {
      const res = await agent.app.bsky.feed.getPosts({ uris: chunk })
      out.push(...res.data.posts)
    } catch {
      /* a bad uri in the chunk shouldn't nuke the whole list */
    }
  }
  return out
}

/* ================================================================== *
 * Mutation: remove a bookmark.
 *
 * Optimistic: drop the entry from whichever cache is live (native infinite
 * pages or local single page). Native path also hits the server; local path
 * mutates localStorage. On error we invalidate to resync.
 * ================================================================== */
export function useRemoveBookmark() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const native = hasNativeBookmarks(agent)

  return useMutation({
    mutationFn: async ({ uri }: { uri: string }) => {
      if (native) {
        const ns = bookmarkNs(agent)!
        if (ns.deleteBookmark) await ns.deleteBookmark({ uri })
      } else {
        removeLocalBookmark(did, uri)
      }
    },
    onMutate: async ({ uri }) => {
      const nativeKey = [...qk.bookmarks(did), 'native'] as const
      const localKey = [...qk.bookmarks(did), 'local'] as const
      await qc.cancelQueries({ queryKey: qk.bookmarks(did) })

      const prevNative = qc.getQueryData<InfiniteData<BookmarkPage>>(nativeKey)
      const prevLocal = qc.getQueryData<BookmarkPage>(localKey)

      if (prevNative) {
        qc.setQueryData<InfiniteData<BookmarkPage>>(nativeKey, {
          ...prevNative,
          pages: prevNative.pages.map((pg) => ({
            ...pg,
            bookmarks: pg.bookmarks.filter((b) => b.post.uri !== uri),
          })),
        })
      }
      if (prevLocal) {
        qc.setQueryData<BookmarkPage>(localKey, {
          ...prevLocal,
          bookmarks: prevLocal.bookmarks.filter((b) => b.post.uri !== uri),
        })
      }
      return { prevNative, prevLocal, nativeKey, localKey }
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return
      if (ctx.prevNative) qc.setQueryData(ctx.nativeKey, ctx.prevNative)
      if (ctx.prevLocal) qc.setQueryData(ctx.localKey, ctx.prevLocal)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.bookmarks(did) })
    },
  })
}

/* ------------------------------------------------------------------ *
 * Convenience for other features: add a bookmark (used by post ⋯ menu).
 * Exposed here so the StrongRef/native-vs-local rule lives in one place.
 * ------------------------------------------------------------------ */
export function useAddBookmark() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const native = hasNativeBookmarks(agent)
  return useMutation({
    mutationFn: async ({ uri, cid }: { uri: string; cid: string }) => {
      if (native) {
        const ns = bookmarkNs(agent)!
        if (ns.createBookmark) await ns.createBookmark({ uri, cid })
      } else {
        addLocalBookmark(did, { uri, cid })
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.bookmarks(did) }),
  })
}

/** True when bookmarks are client-only (localStorage) for the current agent. */
export function useBookmarkMode(): 'native' | 'local' {
  const { agent } = useAgent()
  return useMemo(() => (hasNativeBookmarks(agent) ? 'native' : 'local'), [agent])
}
