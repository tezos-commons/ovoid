import { createContext, useContext } from 'react'
import type { AppBskyFeedDefs } from '@atproto/api'

/**
 * The interaction handlers a PostCard needs. Defined here (in components) so
 * PostCard depends only on this interface, never on feature code. The concrete
 * implementation is injected at the app root by PostActionsBridge (which knows
 * about the like/repost mutations and the compose store). This inversion keeps
 * the components layer free of feature imports while making every PostCard —
 * on any screen — interactive without per-surface wiring.
 */
export interface PostActions {
  toggleLike: (post: AppBskyFeedDefs.PostView) => void
  toggleRepost: (post: AppBskyFeedDefs.PostView) => void
  reply: (post: AppBskyFeedDefs.PostView) => void
  quote: (post: AppBskyFeedDefs.PostView) => void
  share: (post: AppBskyFeedDefs.PostView) => void
}

const PostActionsContext = createContext<PostActions | null>(null)

export const PostActionsProvider = PostActionsContext.Provider

/** Post interaction handlers, or null when no bridge is mounted (e.g. tests). */
export function usePostActions(): PostActions | null {
  return useContext(PostActionsContext)
}
