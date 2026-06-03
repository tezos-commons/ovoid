import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { Avatar, EmptyState, ErrorState, Spinner } from '@/components'
import { relativeTime } from '@/lib/time'
import { useConvos } from './use-convos'
import { isChatPermissionError } from './chat-errors'
import { ChatScopeMissing } from './MessageThread'

export interface ConvoListProps {
  viewerDid: string | undefined
  /** Currently open convo, highlighted in the list. */
  activeConvoId?: string
}

function otherMember(
  convo: ChatBskyConvoDefs.ConvoView,
  viewerDid: string | undefined,
): ChatBskyConvoDefs.ConvoView['members'][number] | undefined {
  const others = convo.members.filter((m) => m.did !== viewerDid)
  return others[0] ?? convo.members[0]
}

function previewOf(convo: ChatBskyConvoDefs.ConvoView): string {
  const last = convo.lastMessage
  if (!last) return ''
  if (last.$type === 'chat.bsky.convo.defs#messageView') {
    return (last as ChatBskyConvoDefs.MessageView).text || ''
  }
  if (last.$type === 'chat.bsky.convo.defs#deletedMessageView') return 'Message deleted'
  return 'New activity'
}

function lastTime(convo: ChatBskyConvoDefs.ConvoView): string {
  const last = convo.lastMessage as { sentAt?: string } | undefined
  return last?.sentAt ? relativeTime(last.sentAt) : ''
}

export function ConvoList({ viewerDid, activeConvoId }: ConvoListProps) {
  const q = useConvos()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
          q.fetchNextPage()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [q.hasNextPage, q.isFetchingNextPage, q])

  if (q.isError) {
    if (isChatPermissionError(q.error)) return <ChatScopeMissing />
    return (
      <div className="convo-list__state">
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn’t load messages" />
      </div>
    )
  }

  if (q.isLoading) {
    return (
      <div className="convo-list__state">
        <Spinner />
      </div>
    )
  }

  if (q.convos.length === 0) {
    return (
      <div className="convo-list__state">
        <EmptyState
          title="No messages yet"
          message="When you start a conversation, it’ll show up here."
        />
      </div>
    )
  }

  return (
    <div className="convo-list" role="list">
      {q.convos.map((convo) => {
        const other = otherMember(convo, viewerDid)
        const name = other?.displayName?.trim() || (other?.handle ? `@${other.handle}` : 'Unknown')
        const unread = convo.unreadCount > 0
        return (
          <Link
            key={convo.id}
            to={`/messages/${convo.id}`}
            className={clsx('convo-row', {
              'convo-row--active': convo.id === activeConvoId,
              'convo-row--unread': unread,
            })}
            role="listitem"
          >
            <Avatar
              src={other?.avatar}
              alt={name}
              fallback={other?.displayName ?? other?.handle}
              size="md"
            />
            <div className="convo-row__body">
              <div className="convo-row__top">
                <span className="convo-row__name">{name}</span>
                <span className="convo-row__time">{lastTime(convo)}</span>
              </div>
              <div className="convo-row__bottom">
                <span className="convo-row__preview">{previewOf(convo)}</span>
                {unread && <span className="convo-row__dot" aria-label={`${convo.unreadCount} unread`} />}
              </div>
            </div>
          </Link>
        )
      })}
      <div ref={sentinelRef} className="convo-list__sentinel">
        {q.isFetchingNextPage && <Spinner size="sm" />}
      </div>
    </div>
  )
}
