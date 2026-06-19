import { memo, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { Avatar, AvatarGroup, ConvoListSkeleton, EmptyState, ErrorState, Spinner } from '@/components'
import { relativeTime } from '@/lib/time'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { qk } from '@/lib/query-keys'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { useConvos } from './use-convos'
import { messagesOptions } from './use-messages'
import { convoTitle, groupKind, otherMember } from './group'
import { isChatPermissionError } from './chat-errors'
import { ChatScopeMissing } from './MessageThread'

export interface ConvoListProps {
  viewerDid: string | undefined
  /** Currently open convo, highlighted in the list. */
  activeConvoId?: string
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
    return <ConvoListSkeleton />
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
      {q.convos.map((convo) => (
        <ConvoRow
          key={convo.id}
          convo={convo}
          viewerDid={viewerDid}
          activeConvoId={activeConvoId}
        />
      ))}
      <div ref={sentinelRef} className="convo-list__sentinel">
        {q.isFetchingNextPage && <Spinner size="sm" />}
      </div>
    </div>
  )
}

/**
 * One convo row. Extracted so it can prefetch its message thread's head page
 * once it scrolls into view — opening the conversation then renders instantly.
 * memo: the list re-renders on every 15s poll; convo views are referentially
 * stable via structural sharing, so unchanged rows skip.
 */
const ConvoRow = memo(function ConvoRow({
  convo,
  viewerDid,
  activeConvoId,
}: {
  convo: ChatBskyConvoDefs.ConvoView
  viewerDid: string | undefined
  activeConvoId?: string
}) {
  const { chatAgent, did } = useAgent()
  const group = groupKind(convo)
  const other = otherMember(convo, viewerDid)
  const name = convoTitle(convo, viewerDid)
  const unread = convo.unreadCount > 0

  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    if (!chatAgent) return
    // Warm the message head page, and seed the single-convo cache from the list
    // entry we already hold so the thread header / settings render without a
    // getConvo round-trip on open. setQueryData here matches qk.convo exactly.
    const opts = messagesOptions(chatAgent, convo.id)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchInfiniteQuery(opts))
    queryClient.setQueryData(qk.convo(did, convo.id), convo)
  })

  return (
    <Link
      ref={prefetchRef}
      to={`/messages/${convo.id}`}
      className={clsx('convo-row', {
        'convo-row--active': convo.id === activeConvoId,
        'convo-row--unread': unread,
      })}
      role="listitem"
    >
      {group ? (
        <AvatarGroup members={convo.members} size="md" total={group.memberCount} />
      ) : (
        <Avatar src={other?.avatar} alt={name} fallback={other?.displayName ?? other?.handle} size="md" />
      )}
      <div className="convo-row__body">
        <div className="convo-row__top">
          <span className="convo-row__name">{name}</span>
          <span className="convo-row__time">{lastTime(convo)}</span>
        </div>
        <div className="convo-row__bottom">
          <span className="convo-row__preview">
            {group ? `${group.memberCount} members · ` : ''}
            {previewOf(convo)}
          </span>
          {unread && <span className="convo-row__dot" aria-label={`${convo.unreadCount} unread`} />}
        </div>
      </div>
    </Link>
  )
})
