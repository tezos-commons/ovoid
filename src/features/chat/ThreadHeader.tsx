import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Agent, ChatBskyConvoDefs } from '@atproto/api'
import { Avatar, AvatarGroup, IconButton, Menu } from '@/components'
import { ScreenHeader } from '@/components/layout'
import { BackIcon, MoreIcon } from '@/components/Icon'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { runWhenIdle } from '@/lib/idle'
import { convoTitle, groupKind, otherMember, viewerOwnsGroup } from './group'
import { convoMembersOptions } from './use-convo-members'
import { joinRequestsOptions } from './use-join-requests'
import { useLeaveConvo } from './use-leave-convo'

export interface ThreadHeaderProps {
  convo: ChatBskyConvoDefs.ConvoView | undefined
  convoId: string
  viewerDid: string | undefined
}

/**
 * Detail-pane header for an open conversation. Branches on convo kind:
 *  - DM: avatar + name linking to the other member's profile.
 *  - Group: avatar stack + group name linking to settings, plus an overflow
 *    menu (settings / leave). The leave hook lives here (not in ChatScreen) so
 *    it stays unconditional — this header only mounts with an active convo.
 *
 * Back button returns to the list on mobile; harmless on desktop two-pane.
 */
export function ThreadHeader({ convo, convoId, viewerDid }: ThreadHeaderProps) {
  const navigate = useNavigate()
  const { chatAgent, did } = useAgent()
  const leave = useLeaveConvo(convoId)
  const group = convo ? groupKind(convo) : undefined

  // The header links to group settings; warm its primary reads on idle so the
  // settings screen renders from cache. Owner-only join requests warm too. First
  // pages only, concurrency-bounded — never on the critical render path.
  const owner = viewerOwnsGroup(convo, did)
  useEffect(() => {
    if (!group || !chatAgent) return
    return runWhenIdle(() => {
      const m = convoMembersOptions(chatAgent as Agent, did, convoId)
      schedulePrefetch(m.queryKey, () => queryClient.prefetchInfiniteQuery(m))
      if (owner) {
        const j = joinRequestsOptions(chatAgent as Agent, did, convoId)
        schedulePrefetch(j.queryKey, () => queryClient.prefetchInfiniteQuery(j))
      }
    })
  }, [group, chatAgent, did, convoId, owner])

  const back = (
    <span className="chat-detail-back">
      <IconButton label="Back to messages" onClick={() => navigate('/messages')}>
        <BackIcon size={20} />
      </IconButton>
    </span>
  )

  if (group) {
    const title = (
      <Link to={`/messages/${convoId}/settings`} className="chat-detail-title" title="Group settings">
        <AvatarGroup members={convo!.members} size="sm" max={3} />
        <span className="chat-detail-title__name">{convoTitle(convo!, viewerDid)}</span>
      </Link>
    )
    const onLeave = () => {
      if (!confirm('Leave this group chat?')) return
      leave.mutate(undefined, { onSuccess: () => navigate('/messages') })
    }
    const items = [
      { key: 'settings', label: 'Group settings', onSelect: () => navigate(`/messages/${convoId}/settings`) },
      { key: 'leave', label: 'Leave group', danger: true, onSelect: onLeave },
    ]
    return (
      <ScreenHeader
        title={title}
        actions={
          <span className="chat-detail-actions">
            <Menu trigger={<IconButton label="Group options"><MoreIcon size={20} /></IconButton>} items={items} />
            {back}
          </span>
        }
      />
    )
  }

  // 1:1 DM
  const other = convo ? otherMember(convo, viewerDid) : undefined
  const title = other ? (
    <Link to={`/profile/${other.handle}`} className="chat-detail-title" title={`View @${other.handle}`}>
      <Avatar
        src={other.avatar}
        alt={other.displayName ?? other.handle}
        fallback={other.displayName ?? other.handle}
        size="sm"
      />
      <span className="chat-detail-title__name">{other.displayName?.trim() || `@${other.handle}`}</span>
    </Link>
  ) : (
    'Conversation'
  )

  return <ScreenHeader title={title} actions={back} />
}
