import { useLocation } from 'react-router-dom'
import { PencilIcon } from '../Icon'
import { useAuth } from '@/lib/api/agent'

export interface ComposeFabProps {
  /** Open the global compose modal (wired by RootLayout). */
  onNewPost?: () => void
}

/**
 * Mobile-only floating compose button. The desktop New Post action lives in the
 * TopBar, which is hidden below the breakpoint — so on phones we surface compose
 * here instead, but only on the feed-reading surfaces (Home and a single feed
 * view) where "write a post" is the expected primary action. Pinned bottom-right
 * just above the BottomTabBar (see layout.css); hidden on desktop via CSS.
 */
function isComposeSurface(pathname: string): boolean {
  // Home (the index route) or an individual feed view (profile/:actor/feed/:rkey).
  return pathname === '/' || /\/feed\/[^/]+\/?$/.test(pathname)
}

export function ComposeFab({ onNewPost }: ComposeFabProps) {
  const { isAuthed } = useAuth()
  const { pathname } = useLocation()
  if (!isAuthed || !isComposeSurface(pathname)) return null

  return (
    <button
      className="compose-fab"
      onClick={onNewPost}
      title="New Post"
      aria-label="New Post"
    >
      <PencilIcon size={22} />
    </button>
  )
}
