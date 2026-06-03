import { create } from 'zustand'

export type ArtifactMode = 'closed' | 'full' | 'mini'

/**
 * The currently-playing interactive NFT artifact. Global + singleton so the
 * iframe is mounted in one place (the root-level ArtifactPlayer) and keeps
 * running — audio included — as it moves between fullscreen and the draggable
 * mini window, and after the NFT browser that launched it is closed. fa/tokenId
 * are retained so expanding from the mini player can re-open that token's
 * browser.
 */
interface ArtifactState {
  mode: ArtifactMode
  src?: string
  title?: string
  fa?: string
  tokenId?: string
  open: (a: { src: string; title?: string; fa: string; tokenId: string }) => void
  minimize: () => void
  expand: () => void
  close: () => void
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  mode: 'closed',
  open: ({ src, title, fa, tokenId }) => set({ mode: 'full', src, title, fa, tokenId }),
  minimize: () => set({ mode: 'mini' }),
  expand: () => set({ mode: 'full' }),
  close: () => set({ mode: 'closed', src: undefined, title: undefined, fa: undefined, tokenId: undefined }),
}))
