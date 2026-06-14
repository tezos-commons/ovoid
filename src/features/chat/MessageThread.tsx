import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { Avatar, Button, EmptyState, ErrorState, MessageThreadSkeleton, Spinner } from '@/components'
import { MobileBottomContent } from '@/components/layout'
import { useIsMobile } from '@/lib/use-is-mobile'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'
import { SystemMessage, referredDids } from './SystemMessage'
import { useMessages, useMarkRead, type MessageItem } from './use-messages'
import { useToggleReaction } from './use-react-message'
import { useChatProfiles } from './use-chat-profiles'
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
  // Whether the view is stuck to the bottom (start true so first paint pins).
  const stick = useRef(true)

  // Pin to bottom on first load and when a new newest message appears, but only
  // while the user is stuck to the bottom (don't yank them up from history).
  // scrollTop = scrollHeight (not scrollIntoView) reaches the true bottom past
  // the scroll padding reserved for the floating composer.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const firstLoad = prevLatest.current === undefined && latestId !== undefined
    const grew = latestId !== prevLatest.current
    if (firstLoad) stick.current = true
    if ((firstLoad || grew) && stick.current) {
      el.scrollTop = el.scrollHeight
    }
    prevLatest.current = latestId
  }, [latestId])

  // Keep pinned to the bottom as the scroll region resizes — late-loading media
  // on open (content grows) and the keyboard opening (container shrinks) both
  // fire this, so the newest message stays visible without a manual scroll.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const pin = () => {
      if (stick.current) el.scrollTop = el.scrollHeight
    }
    const ro = new ResizeObserver(pin)
    ro.observe(el)
    const inner = el.firstElementChild
    if (inner) ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  // The on-screen keyboard opening/closing shrinks the usable height in steps
  // (visualViewport → --kb → chat-screen height). The ResizeObserver can pin
  // mid-transition, before the final height settles, leaving the newest message
  // short of the bottom. Re-pin on the settle frame when the keyboard changes,
  // but only while stuck to the bottom so we don't yank the user out of history.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const repin = () => {
      const el = scrollRef.current
      if (!el || !stick.current) return
      requestAnimationFrame(() => {
        if (stick.current && scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }
    vv.addEventListener('resize', repin)
    return () => vv.removeEventListener('resize', repin)
  }, [])

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
      // Track whether the user is parked at the bottom (drives auto-pin above).
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150
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
  // is built from the partial convo roster (the "important members").
  const memberByDid = useMemo(() => {
    const m = new Map<string, ConvoMember>()
    for (const member of convo?.members ?? []) m.set(member.did, member)
    return m
  }, [convo?.members])

  const items = useMemo(() => buildThreadItems(messages), [messages])

  // DIDs referenced by the thread (senders + system-message subjects) that the
  // partial roster doesn't cover — e.g. someone who just joined via an invite
  // link. Resolve them via getProfiles so they render as a name, not a raw DID.
  const unresolvedDids = useMemo(() => {
    const set = new Set<string>()
    for (const it of items) {
      if (it.kind === 'system') {
        for (const m of it.msgs) for (const d of referredDids(m)) set.add(d)
      } else {
        const sd = 'sender' in it.msg ? it.msg.sender?.did : undefined
        if (sd) set.add(sd)
      }
    }
    return [...set].filter((d) => !memberByDid.has(d))
  }, [items, memberByDid])
  const profiles = useChatProfiles(unresolvedDids)

  const nameFor = (did: string): string => {
    const member = memberByDid.get(did)
    if (member) return memberName(member)
    const p = profiles.get(did)
    if (p) return p.displayName?.trim() || (p.handle ? `@${p.handle}` : `${did.slice(0, 12)}…`)
    return `${did.slice(0, 12)}…`
  }
  const avatarFor = (did: string): string | undefined =>
    memberByDid.get(did)?.avatar ?? profiles.get(did)?.avatar

  // One reaction mutation for the whole thread; bubbles call it via onReact.
  const reaction = useToggleReaction(convoId)
  const onReact = viewerDid
    ? (messageId: string, value: string, add: boolean) =>
        reaction.mutate({ messageId, value, add })
    : undefined

  // A locked group accepts no new messages; lock the composer to match.
  const replyDisabled = group ? group.lockStatus !== 'unlocked' : false

  const isMobile = useIsMobile()
  const composer = (
    <MessageComposer convoId={convoId} disabled={replyDisabled} members={convo?.members ?? []} />
  )

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
                    <SystemMessage
                      msgs={item.msgs}
                      collapsed={item.collapsed}
                      nameFor={nameFor}
                      avatarFor={avatarFor}
                    />
                  </div>
                )
              }
              const sd = 'sender' in item.msg ? item.msg.sender?.did : undefined
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
                    senderAvatar={sd ? avatarFor(sd) : undefined}
                    onReact={onReact}
                  />
                </div>
              )
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>
      {/* Mobile: the composer lives in the floating bottom bar, shown by default
          (chat's primary action). Desktop: in-flow. */}
      {isMobile ? <MobileBottomContent defaultShown>{composer}</MobileBottomContent> : composer}
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
