import { create } from 'zustand'

/** A token identity the browser can point at. */
export interface NftRef {
  fa: string
  tokenId: string
}

/**
 * Drives the fullscreen NFT browser. A module-level singleton (like the compose
 * store) so any token preview can open it, and the browser can re-point itself
 * at another token (navigating within the same fullscreen view).
 *
 * `list`/`index` carry an optional navigation context: the ordered set of
 * sibling tokens the view was opened from (e.g. a profile collection grid), so
 * the browser can offer prev/next. Re-pointing without a list (the "By artist"
 * tab, a link embed) clears it — those tokens aren't part of the sequence.
 */
interface NftBrowserState {
  open: boolean
  fa?: string
  tokenId?: string
  /** Sibling tokens for prev/next; empty when there's no sequence to step. */
  list: NftRef[]
  /** Position of the current token within `list`, or -1 if not in it. */
  index: number
  openNft: (fa: string, tokenId: string, list?: NftRef[]) => void
  /** Step within `list` by delta (clamped); no-op without a sequence. */
  go: (delta: number) => void
  close: () => void
}

export const useNftBrowserStore = create<NftBrowserState>((set) => ({
  open: false,
  list: [],
  index: -1,
  openNft: (fa, tokenId, list) =>
    set({
      open: true,
      fa,
      tokenId,
      list: list ?? [],
      index: list ? list.findIndex((r) => r.fa === fa && r.tokenId === tokenId) : -1,
    }),
  go: (delta) =>
    set((s) => {
      if (s.index < 0) return s
      const i = s.index + delta
      if (i < 0 || i >= s.list.length) return s
      const ref = s.list[i]
      return { fa: ref.fa, tokenId: ref.tokenId, index: i }
    }),
  close: () => set({ open: false }),
}))
