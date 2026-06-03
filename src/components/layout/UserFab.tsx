import { Avatar } from '../Avatar'
import { useAuth } from '@/lib/api/agent'

/**
 * The viewer's account, separated from the nav rail: a single circular avatar
 * pinned to the bottom-left of the page. Click signs out. Hidden on mobile,
 * where the bottom tab bar covers navigation.
 */
export function UserFab() {
  const { isAuthed, handle, displayName, avatar, signOut } = useAuth()
  if (!isAuthed) return null

  return (
    <button className="user-fab" onClick={() => void signOut()} title="Sign out" aria-label="Sign out">
      <Avatar size="md" src={avatar} alt={handle} fallback={displayName || handle} />
    </button>
  )
}
