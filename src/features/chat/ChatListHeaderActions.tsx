import { IconButton } from '@/components'
import { useChatStore } from '@/store/chat-store'
import { useChatStatus } from './use-chat-status'

/**
 * Actions slot for the messages list header: the "new group chat" entry.
 * Gated on the server-authoritative `canCreateGroups` (new / restricted accounts
 * can't create groups). When disabled, the button is dimmed with a reason title
 * rather than hidden, so the affordance is discoverable.
 */
export function ChatListHeaderActions() {
  const open = useChatStore((s) => s.openCreateGroup)
  const { canCreateGroups, chatDisabled, isLoading } = useChatStatus()

  if (isLoading) return null
  const allowed = canCreateGroups && !chatDisabled

  return (
    <IconButton
      label={allowed ? 'New group chat' : 'Your account can’t create group chats yet'}
      disabled={!allowed}
      onClick={() => allowed && open()}
    >
      <NewGroupIcon />
    </IconButton>
  )
}

function NewGroupIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden="true">
      <path
        d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-6 1.8-6 4v2h9.2A6 6 0 0 1 12 17c0-1.5.5-2.9 1.4-4A11 11 0 0 0 9 13Z"
        fill="currentColor"
      />
      <path
        d="M18 13v3h3v2h-3v3h-2v-3h-3v-2h3v-3h2Z"
        fill="currentColor"
      />
    </svg>
  )
}
