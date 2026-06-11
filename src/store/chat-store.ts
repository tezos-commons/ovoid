import { create } from 'zustand'

/**
 * Ephemeral chat UI intent (group dialogs). A module-level singleton like
 * compose-store, so the messages list header, a thread overflow menu, or a
 * settings screen can all drive the one globally-mounted create-group dialog.
 * Server data never lives here — only transient open/close state.
 */
interface ChatUiState {
  createGroupOpen: boolean
  openCreateGroup: () => void
  closeCreateGroup: () => void
}

export const useChatStore = create<ChatUiState>((set) => ({
  createGroupOpen: false,
  openCreateGroup: () => set({ createGroupOpen: true }),
  closeCreateGroup: () => set({ createGroupOpen: false }),
}))
