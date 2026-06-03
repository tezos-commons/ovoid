import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar, IconButton } from '@/components'
import { ScreenHeader } from '@/components/layout'
import { BackIcon } from '@/components/Icon'
import { useAgent } from '@/lib/api/agent'
import { ConvoList } from './ConvoList'
import { MessageThread } from './MessageThread'
import { useConvos } from './use-convos'
import './chat.css'

/**
 * DM two-pane root.
 *
 * Desktop (≥800px): list rail + detail pane side by side within the 600px column.
 * Mobile (<800px): single column, master/detail. The route param decides which
 * view is "active":
 *   /messages            -> convo list (master)
 *   /messages/:convoId   -> message thread (detail)
 * On desktop both render; the param just selects the highlighted/open convo.
 *
 * All chat traffic goes through bundle.chatAgent (the proxied agent). When
 * signed out chatAgent is null; the route is protected so that path is only
 * hit transiently — ConvoList/MessageThread render their own disabled states.
 */
export default function ChatScreen() {
  // The full-width page area (no reserved aside) is decided by route in
  // RootLayout (FULL_WIDTH_PREFIXES), so it's already applied before this lazy
  // screen mounts — no width jump while the chunk loads.
  const { convoId } = useParams<{ convoId?: string }>()
  const navigate = useNavigate()
  const { did } = useAgent()

  // Resolve the open convo from the cached list for the detail header (avatar +
  // name) without an extra getConvo round-trip on the common case.
  const convosQ = useConvos()
  const activeConvo = useMemo(
    () => convosQ.convos.find((c) => c.id === convoId),
    [convosQ.convos, convoId],
  )
  const other = activeConvo?.members?.find((m) => m.did !== did)

  const detailTitle = convoId
    ? other
      ? (
          <Link
            to={`/profile/${other.handle}`}
            className="chat-detail-title"
            title={`View @${other.handle}`}
          >
            <Avatar
              src={other.avatar}
              alt={other.displayName ?? other.handle}
              fallback={other.displayName ?? other.handle}
              size="sm"
            />
            <span className="chat-detail-title__name">
              {other.displayName?.trim() || `@${other.handle}`}
            </span>
          </Link>
        )
      : 'Conversation'
    : 'Messages'

  return (
    <div className="chat-screen" data-detail={convoId ? 'open' : 'closed'}>
      {/* Master pane: conversation list */}
      <section className="chat-pane chat-pane--list" aria-label="Conversations">
        <ScreenHeader title="Messages" />
        <ConvoList viewerDid={did} activeConvoId={convoId} />
      </section>

      {/* Detail pane: active conversation */}
      <section className="chat-pane chat-pane--detail" aria-label="Conversation">
        {convoId ? (
          <>
            <ScreenHeader
              title={detailTitle}
              // back returns to the list on mobile; harmless on desktop.
              actions={
                <span className="chat-detail-back">
                  <IconButton label="Back to messages" onClick={() => navigate('/messages')}>
                    <BackIcon size={20} />
                  </IconButton>
                </span>
              }
            />
            <MessageThread convoId={convoId} convo={activeConvo} viewerDid={did} />
          </>
        ) : (
          <div className="chat-empty-detail">
            <p>Select a conversation to start chatting.</p>
          </div>
        )}
      </section>
    </div>
  )
}
