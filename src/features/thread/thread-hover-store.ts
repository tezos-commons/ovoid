import { create } from 'zustand'

/**
 * Ephemeral cross-tree channel: which thread author is currently hovered. The
 * thread posts (main column) set it via event delegation; the author grid (page
 * aside, a separate DOM subtree) reads it to highlight the matching avatar.
 * A dedicated store keeps the post tree from re-rendering on hover — only the
 * grid subscribes to the value; setters are stable.
 */
interface ThreadHoverState {
  hoveredDid: string | null
  setHovered: (did: string | null) => void
}

export const useThreadHover = create<ThreadHoverState>((set) => ({
  hoveredDid: null,
  // No-op when unchanged so repeated mouseover events don't churn subscribers.
  setHovered: (did) => set((s) => (s.hoveredDid === did ? s : { hoveredDid: did })),
}))
