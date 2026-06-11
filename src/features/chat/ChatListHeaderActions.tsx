import { IconButton } from '@/components'
import { useChatStore } from '@/store/chat-store'

/**
 * Actions slot for the messages list header: the "new chat" entry. Opens the
 * unified new-chat dialog (one person = DM, multiple = group). Always available —
 * starting a direct message needs no gating; the group path is gated inside the
 * dialog on canCreateGroups.
 */
export function ChatListHeaderActions() {
  const open = useChatStore((s) => s.openNewChat)
  return (
    <IconButton label="New chat" onClick={open}>
      <NewChatIcon />
    </IconButton>
  )
}

function NewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden="true">
      <path
        d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 8v5M9.5 10.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
