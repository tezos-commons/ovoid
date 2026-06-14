import { create } from 'zustand'

/**
 * Ephemeral open-state for the two global keyboard overlays: the command palette
 * (⌘K) and the keyboard-shortcuts cheat sheet (?). A module-level singleton so
 * the global shortcut hook and palette commands can open either from anywhere.
 * Opening one closes the other — they share the modal layer.
 */
interface CommandState {
  palette: boolean
  shortcuts: boolean
  openPalette: () => void
  openShortcuts: () => void
  close: () => void
}

export const useCommandStore = create<CommandState>((set) => ({
  palette: false,
  shortcuts: false,
  openPalette: () => set({ palette: true, shortcuts: false }),
  openShortcuts: () => set({ shortcuts: true, palette: false }),
  close: () => set({ palette: false, shortcuts: false }),
}))
