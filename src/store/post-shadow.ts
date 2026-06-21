import { useMemo } from 'react'
import { create } from 'zustand'
import type { AppBskyFeedDefs } from '@atproto/api'

/**
 * Optimistic like / repost overlay, held OUTSIDE the React Query cache.
 *
 * Why this exists: server state is stale-while-revalidate with a 30s staleTime
 * and a disk persister, so any background refetch (or the thread's own fresh
 * getPostThread) returns AppView data that may not have indexed a just-made
 * like/repost yet — clobbering an in-cache optimistic patch. The result was
 * likes that "didn't stick" and feed/thread counts disagreeing.
 *
 * The shadow is merged on top of whatever the cache holds at *render* time
 * (`usePostShadow`), so refetches freely update the base data while the viewer's
 * own action always wins. The merge is delta-based — it adjusts the count
 * relative to the base's own like/repost flag — so once the server catches up
 * the override becomes a no-op (count delta 0) rather than double-counting.
 *
 * Field encoding (per uri): `undefined` = no override; `null` = explicitly
 * un-liked / un-reposted; a string = liked / reposted (the record uri, or the
 * pending sentinel until the create resolves).
 */
export interface PostShadow {
  likeUri?: string | null
  repostUri?: string | null
}

interface ShadowState {
  shadows: Record<string, PostShadow>
  setShadow: (uri: string, patch: PostShadow) => void
}

export const usePostShadowStore = create<ShadowState>((set) => ({
  shadows: {},
  setShadow: (uri, patch) =>
    set((s) => ({ shadows: { ...s.shadows, [uri]: { ...s.shadows[uri], ...patch } } })),
}))

/** Imperative accessor for use inside mutation callbacks (no subscription). */
export const setPostShadow = (uri: string, patch: PostShadow): void =>
  usePostShadowStore.getState().setShadow(uri, patch)

/** Apply a shadow to a PostView, adjusting viewer state + counts. Pure. */
export function mergePostShadow(
  post: AppBskyFeedDefs.PostView,
  shadow: PostShadow | undefined,
): AppBskyFeedDefs.PostView {
  if (!shadow || (shadow.likeUri === undefined && shadow.repostUri === undefined)) return post

  let viewer = post.viewer ?? {}
  let likeCount = post.likeCount ?? 0
  let repostCount = post.repostCount ?? 0

  if (shadow.likeUri !== undefined) {
    const base = !!post.viewer?.like
    const next = shadow.likeUri !== null
    likeCount = Math.max(0, likeCount + (next ? 1 : 0) - (base ? 1 : 0))
    viewer = { ...viewer, like: next ? (shadow.likeUri as string) : undefined }
  }
  if (shadow.repostUri !== undefined) {
    const base = !!post.viewer?.repost
    const next = shadow.repostUri !== null
    repostCount = Math.max(0, repostCount + (next ? 1 : 0) - (base ? 1 : 0))
    viewer = { ...viewer, repost: next ? (shadow.repostUri as string) : undefined }
  }

  return { ...post, viewer, likeCount, repostCount }
}

/**
 * Return `post` with its optimistic like/repost overlay applied. Subscribes only
 * to this post's shadow entry, so an action on one post never re-renders others.
 */
export function usePostShadow(post: AppBskyFeedDefs.PostView): AppBskyFeedDefs.PostView {
  const shadow = usePostShadowStore((s) => s.shadows[post.uri])
  return useMemo(() => mergePostShadow(post, shadow), [post, shadow])
}
