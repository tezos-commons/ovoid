import type { AppBskyFeedDefs } from '@atproto/api'
import { Avatar } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useComposer } from '@/store/compose-store'

export interface ReplyBarProps {
  /** The post this bar replies to (the focused thread post). */
  parent: AppBskyFeedDefs.PostView
}

/**
 * Tappable "write your reply" bar pinned under the focused post. Tapping it opens
 * the global compose sheet in reply mode (slides up from the bottom on mobile)
 * — matching the native Bluesky reply flow, rather than an inline editable box.
 */
export function ReplyBar({ parent }: ReplyBarProps) {
  const { isAuthed, handle, avatar } = useAgent()
  const { openReply } = useComposer()

  if (!isAuthed) {
    return <div className="reply-bar reply-bar--signedout">Sign in to reply to this post.</div>
  }

  return (
    <button type="button" className="reply-bar" onClick={() => openReply(parent)}>
      <Avatar size="sm" src={avatar} alt={handle} fallback={(handle ?? '?').charAt(0).toUpperCase()} />
      <span className="reply-bar__placeholder">Write your reply</span>
    </button>
  )
}
