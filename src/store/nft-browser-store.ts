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
  /**
   * Stories presentation for the interesting-tokens recommendations: progress
   * segments, tap-to-step, and the friend-activity pane instead of details.
   */
  showcase: boolean
  openNft: (fa: string, tokenId: string, list?: NftRef[]) => void
  /** Open the recommendation showcase at `startIndex` (default: first token). */
  openShowcase: (list: NftRef[], startIndex?: number) => void
  /** Step within `list` by delta (clamped); no-op without a sequence. */
  go: (delta: number) => void
  close: () => void
}

export const useNftBrowserStore = create<NftBrowserState>((set) => ({
  open: false,
  list: [],
  index: -1,
  showcase: false,
  openNft: (fa, tokenId, list) =>
    set({
      open: true,
      fa,
      tokenId,
      list: list ?? [],
      index: list ? list.findIndex((r) => r.fa === fa && r.tokenId === tokenId) : -1,
      showcase: false,
    }),
  openShowcase: (list, startIndex = 0) => {
    const index = Math.min(Math.max(startIndex, 0), list.length - 1)
    const ref = list[index]
    if (!ref) return
    set({ open: true, fa: ref.fa, tokenId: ref.tokenId, list, index, showcase: true })
  },
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

/* ------------------------------------------------------------
   Showcase return marker. The showcase is overlay state, not a
   route — navigating out of it (an actor's profile, the creator)
   and pressing Back lands on a bare homepage. Stash the story
   before leaving; HomeScreen restores it when it remounts via a
   POP navigation. sessionStorage: per-tab, survives the route
   unmount, gone with the tab.
   ------------------------------------------------------------ */
const RETURN_KEY = 'ovoid:showcase-return'

export function stashShowcaseReturn(list: NftRef[], index: number): void {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ list, index }))
  } catch {
    /* storage unavailable — Back simply won't restore the story */
  }
}

/** Read AND clear the marker (consumed on the next Home mount either way). */
export function takeShowcaseReturn(): { list: NftRef[]; index: number } | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY)
    if (!raw) return null
    sessionStorage.removeItem(RETURN_KEY)
    const v = JSON.parse(raw) as { list?: NftRef[]; index?: number }
    if (!Array.isArray(v.list) || v.list.length === 0) return null
    return { list: v.list, index: typeof v.index === 'number' ? v.index : 0 }
  } catch {
    return null
  }
}
