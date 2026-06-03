import { create } from 'zustand'
import type { AppBskyFeedDefs } from '@atproto/api'

/**
 * Ephemeral composer intent. A module-level singleton (like ui-store) so any
 * surface — the home composer row, a post's reply/quote action anywhere, the
 * shell's New Post button — drives the one globally-mounted compose modal.
 */
export interface ComposeTarget {
  /** When set, the new post is a reply to this post. */
  replyTo?: AppBskyFeedDefs.PostView
  /** When set, the new post quotes this post (embed.record). */
  quote?: AppBskyFeedDefs.PostView
}

interface ComposerState {
  open: boolean
  target: ComposeTarget
  openCompose: () => void
  openReply: (post: AppBskyFeedDefs.PostView) => void
  openQuote: (post: AppBskyFeedDefs.PostView) => void
  close: () => void
}

export const useComposerStore = create<ComposerState>((set) => ({
  open: false,
  target: {},
  openCompose: () => set({ open: true, target: {} }),
  openReply: (post) => set({ open: true, target: { replyTo: post } }),
  openQuote: (post) => set({ open: true, target: { quote: post } }),
  close: () => set({ open: false, target: {} }),
}))

/** Stable selector hook for the composer controls. */
export function useComposer() {
  const openCompose = useComposerStore((s) => s.openCompose)
  const openReply = useComposerStore((s) => s.openReply)
  const openQuote = useComposerStore((s) => s.openQuote)
  const close = useComposerStore((s) => s.close)
  return { openCompose, openReply, openQuote, close }
}
