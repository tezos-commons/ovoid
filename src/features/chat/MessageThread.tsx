import { useEffect, useLayoutEffect, useRef } from 'react'
import clsx from 'clsx'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { Avatar, Button, EmptyState, ErrorState, Spinner } from '@/components'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'
import { useMessages, useMarkRead, type MessageItem } from './use-messages'
import { isChatPermissionError } from './chat-errors'

export interface MessageThreadProps {
  convoId: string
  convo?: ChatBskyConvoDefs.ConvoView
  viewerDid: string | undefined
  /** Mobile master/detail: show a back affordance handled by the header instead. */
}

const SAME_AUTHOR_GAP_MS = 5 * 60 * 1000

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

  const other = convo?.members?.find((m) => m.did !== viewerDid)
  const replyDisabled = false // convoView exposes no per-viewer reply lock in this lexicon

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
          <div className="msg-thread__center">
            <Spinner />
          </div>
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
            {messages.map((m, i) => {
              const prev = messages[i - 1]
              const sameAuthor =
                prev &&
                'sender' in prev &&
                'sender' in m &&
                prev.sender?.did === m.sender?.did
              const next = messages[i + 1]
              const showTime =
                !next ||
                !('sender' in next) ||
                next.sender?.did !== (m as { sender?: { did?: string } }).sender?.did ||
                gap(m, next) > SAME_AUTHOR_GAP_MS
              return (
                <div key={msgKey(m, i)} className={clsx('msg-line', sameAuthor && 'msg-grouped')}>
                  <MessageBubble message={m} viewerDid={viewerDid} showTime={showTime} />
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

function gap(a: MessageItem, b: MessageItem): number {
  const ta = 'sentAt' in a ? new Date(a.sentAt).getTime() : 0
  const tb = 'sentAt' in b ? new Date(b.sentAt).getTime() : 0
  return Math.abs(tb - ta)
}

function msgKey(m: MessageItem, i: number): string {
  return 'id' in m && m.id ? m.id : `msg-${i}`
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
