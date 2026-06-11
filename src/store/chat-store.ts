import { create } from 'zustand'

/**
 * Ephemeral chat UI intent (the new-chat dialog). A module-level singleton like
 * compose-store, so the messages list header or a thread overflow menu can all
 * drive the one globally-mounted new-chat dialog. Server data never lives here —
 * only transient open/close state.
 */
interface ChatUiState {
  newChatOpen: boolean
  openNewChat: () => void
  closeNewChat: () => void
}

export const useChatStore = create<ChatUiState>((set) => ({
  newChatOpen: false,
  openNewChat: () => set({ newChatOpen: true }),
  closeNewChat: () => set({ newChatOpen: false }),
}))
