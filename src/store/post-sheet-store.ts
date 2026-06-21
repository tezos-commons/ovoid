import { create } from 'zustand'

/**
 * Mobile post viewer. On phones, tapping a post opens its thread in a bottom
 * sheet (overlay) instead of navigating — so the feed underneath never unmounts
 * and its scroll position is preserved with zero restoration logic. Desktop
 * keeps route-based navigation.
 *
 * `actor`/`rkey` identify the thread; opening another post while the sheet is up
 * just swaps the content (no history push), so tapping a reply drills in and a
 * single back closes the whole sheet.
 */
interface PostSheetState {
  open: boolean
  actor: string
  rkey: string
  openPost: (actor: string, rkey: string) => void
  close: () => void
}

export const usePostSheetStore = create<PostSheetState>((set) => ({
  open: false,
  actor: '',
  rkey: '',
  openPost: (actor, rkey) => set({ open: true, actor, rkey }),
  close: () => set({ open: false }),
}))
