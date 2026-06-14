import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ScreenHeader, MobileTopRight, useMobileTitle } from '@/components/layout'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useAgent } from '@/lib/api/agent'
import { ConvoList } from './ConvoList'
import { MessageThread } from './MessageThread'
import { ThreadHeader } from './ThreadHeader'
import { ChatListHeaderActions } from './ChatListHeaderActions'
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
 * Both 1:1 and group convos flow through here — ThreadHeader / ConvoList /
 * MessageThread branch on convo kind internally.
 */
export default function ChatScreen() {
  const { convoId } = useParams<{ convoId?: string }>()
  const { did } = useAgent()

  // Resolve the open convo from the cached list for the detail header (avatar +
  // name / group metadata) without an extra getConvo round-trip on the common case.
  const convosQ = useConvos()
  const activeConvo = useMemo(
    () => convosQ.convos.find((c) => c.id === convoId),
    [convosQ.convos, convoId],
  )

  // Mobile: the list view (no open convo) feeds the floating top bar; an open
  // convo's chrome is owned by ThreadHeader instead.
  const isMobile = useIsMobile()
  useMobileTitle(isMobile && !convoId ? 'Messages' : null)

  return (
    <div className="chat-screen" data-detail={convoId ? 'open' : 'closed'}>
      {isMobile && !convoId && (
        <MobileTopRight>
          <ChatListHeaderActions />
        </MobileTopRight>
      )}
      {/* Master pane: conversation list */}
      <section className="chat-pane chat-pane--list" aria-label="Conversations">
        <ScreenHeader title="Messages" actions={<ChatListHeaderActions />} />
        <ConvoList viewerDid={did} activeConvoId={convoId} />
      </section>

      {/* Detail pane: active conversation */}
      <section className="chat-pane chat-pane--detail" aria-label="Conversation">
        {convoId ? (
          <>
            <ThreadHeader convo={activeConvo} convoId={convoId} viewerDid={did} />
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
