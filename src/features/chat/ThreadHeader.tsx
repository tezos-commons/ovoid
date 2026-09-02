import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Agent, ChatBskyConvoDefs } from '@atproto/api'
import { Avatar, AvatarGroup, IconButton, Menu } from '@/components'
import { ScreenHeader, MobileTopLeft, MobileTopRight } from '@/components/layout'
import { BackIcon, MoreIcon } from '@/components/Icon'
import { useIsMobile } from '@/lib/use-is-mobile'
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
  const isMobile = useIsMobile()
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

  // Build the title + overflow menu per convo kind, then render either the
  // desktop ScreenHeader or the mobile top-bar slots from the same nodes.
  let title: ReactNode
  let menuItems: { key: string; label: string; danger?: boolean; onSelect: () => void }[] = []
  let menuLabel = 'Conversation options'

  if (group) {
    title = (
      <Link to={`/messages/${convoId}/settings`} className="chat-detail-title" title="Group settings">
        <AvatarGroup members={convo!.members} size="sm" max={3} total={group.memberCount} />
        <span className="chat-detail-title__name">{convoTitle(convo!, viewerDid)}</span>
      </Link>
    )
    const onLeave = () => {
      if (!confirm('Leave this group chat?')) return
      leave.mutate(undefined, { onSuccess: () => navigate('/messages') })
    }
    menuLabel = 'Group options'
    menuItems = [
      { key: 'settings', label: 'Group settings', onSelect: () => navigate(`/messages/${convoId}/settings`) },
      { key: 'leave', label: 'Leave group', danger: true, onSelect: onLeave },
    ]
  } else {
    const other = convo ? otherMember(convo, viewerDid) : undefined
    title = other ? (
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
    // DMs have no overflow actions of their own — `menu` renders nothing.
  }

  const menu = menuItems.length ? (
    <Menu trigger={<IconButton label={menuLabel}><MoreIcon size={20} /></IconButton>} items={menuItems} />
  ) : null

  if (isMobile) {
    return (
      <>
        <MobileTopLeft>
          <IconButton label="Back to messages" onClick={() => navigate('/messages')}>
            <BackIcon size={20} />
          </IconButton>
          {title}
        </MobileTopLeft>
        {menu && <MobileTopRight>{menu}</MobileTopRight>}
      </>
    )
  }

  return (
    <ScreenHeader
      title={title}
      actions={<span className="chat-detail-actions">{menu}{back}</span>}
    />
  )
}
