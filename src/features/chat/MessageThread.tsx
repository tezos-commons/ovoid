import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { Avatar, Button, EmptyState, ErrorState, MessageThreadSkeleton, Spinner } from '@/components'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'
import { SystemMessage } from './SystemMessage'
import { useMessages, useMarkRead, type MessageItem } from './use-messages'
import { buildThreadItems } from './thread-items'
import { groupKind, memberName, otherMember, type ConvoMember } from './group'
import { isChatPermissionError } from './chat-errors'

export interface MessageThreadProps {
  convoId: string
  convo?: ChatBskyConvoDefs.ConvoView
  viewerDid: string | undefined
  /** Mobile master/detail: show a back affordance handled by the header instead. */
}

function newestMessageId(messages: MessageItem[]): string | undefined {
  // messages are oldest-first; newest is last and must be a real message.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.$type !== 'chat.bsky.convo.defs#systemMessageView') return m.id
  }
  return undefined
}

export function MessageThread({ convoId, convo, viewerDid }: MessageThreadProps) {
  const q = useMessages(convoId)
  const messages = q.messages
  const latestId = newestMessageId(messages)

  // Clear unread on open and whenever a new newest message arrives while focused.
  useMarkRead(convoId, latestId)

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLatest = useRef<string | undefined>(undefined)
  const prevScrollHeight = useRef(0)

  // Pin to bottom on first load and when a new newest message appears, but only
  // if the user is already near the bottom (don't yank them up from history).
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const firstLoad = prevLatest.current === undefined && latestId !== undefined
    const grew = latestId !== prevLatest.current
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
    if (firstLoad || (grew && nearBottom)) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
    prevLatest.current = latestId
  }, [latestId])

  // When loading OLDER history (fetchNextPage), preserve the scroll position by
  // compensating for the height the prepended page added at the top.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (q.isFetchingNextPage) {
      prevScrollHeight.current = el.scrollHeight
    } else if (prevScrollHeight.current) {
      const delta = el.scrollHeight - prevScrollHeight.current
      if (delta > 0) el.scrollTop += delta
      prevScrollHeight.current = 0
    }
  }, [q.isFetchingNextPage, messages.length])

  // Trigger older-history load when the scroll container hits the top.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (el.scrollTop < 80 && q.hasNextPage && !q.isFetchingNextPage) {
        q.fetchNextPage()
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [q.hasNextPage, q.isFetchingNextPage, q])

  const group = convo ? groupKind(convo) : undefined
  const isGroup = !!group
  const other = convo ? otherMember(convo, viewerDid) : undefined

  // Resolve message sender DIDs to names/avatars for group attribution. The map
  // is built from the partial convo roster; unknown senders fall back to a short
  // DID so a message never renders nameless.
  const memberByDid = useMemo(() => {
    const m = new Map<string, ConvoMember>()
    for (const member of convo?.members ?? []) m.set(member.did, member)
    return m
  }, [convo?.members])
  const nameFor = (did: string): string => {
    const member = memberByDid.get(did)
    return member ? memberName(member) : `${did.slice(0, 12)}…`
  }

  const items = useMemo(() => buildThreadItems(messages), [messages])

  // A locked group accepts no new messages; lock the composer to match.
  const replyDisabled = group ? group.lockStatus !== 'unlocked' : false

  if (q.isError) {
    if (isChatPermissionError(q.error)) {
      return <ChatScopeMissing />
    }
    return (
      <div className="msg-thread__center">
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn’t load messages" />
      </div>
    )
  }

  return (
    <div className="msg-thread">
      <div className="msg-thread__scroll" ref={scrollRef}>
        {q.isLoading ? (
          <MessageThreadSkeleton />
        ) : messages.length === 0 ? (
          <div className="msg-thread__center">
            <EmptyState
              icon={
                other ? (
                  <Avatar src={other.avatar} alt={other.displayName ?? other.handle} size="lg" />
                ) : undefined
              }
              title={other?.displayName || other?.handle || 'No messages yet'}
              message="Say hello to start the conversation."
            />
          </div>
        ) : (
          <>
            {q.isFetchingNextPage && (
              <div className="msg-thread__more">
                <Spinner size="sm" />
              </div>
            )}
            {!q.hasNextPage && (
              <div className="msg-thread__start">Beginning of conversation</div>
            )}
            {items.map((item) => {
              if (item.kind === 'system') {
                return (
                  <div key={item.key} className="msg-line msg-line--system">
                    <SystemMessage msgs={item.msgs} collapsed={item.collapsed} nameFor={nameFor} />
                  </div>
                )
              }
              const sd = 'sender' in item.msg ? item.msg.sender?.did : undefined
              const sender = sd ? memberByDid.get(sd) : undefined
              return (
                <div key={item.key} className={clsx('msg-line', item.sameAuthorPrev && 'msg-grouped')}>
                  <MessageBubble
                    message={item.msg}
                    viewerDid={viewerDid}
                    showTime={item.showTime}
                    isGroup={isGroup}
                    showAvatar={item.lastInCluster}
                    showName={item.firstInCluster}
                    senderName={sd ? nameFor(sd) : undefined}
                    senderAvatar={sender?.avatar}
                  />
                </div>
              )
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>
      <MessageComposer convoId={convoId} disabled={replyDisabled} />
    </div>
  )
}

export function ChatScopeMissing() {
  return (
    <div className="msg-thread__center">
      <EmptyState
        title="Direct messages aren’t enabled"
        message="This sign-in doesn’t have access to your direct messages. Sign in again and grant the chat permission to use messaging."
        action={
          <Button variant="secondary" onClick={() => window.location.assign('/login')}>
            Re-authorize
          </Button>
        }
      />
    </div>
  )
}
