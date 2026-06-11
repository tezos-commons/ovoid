import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  AvatarGroup,
  Button,
  EmptyState,
  ErrorState,
  Menu,
  Spinner,
} from '@/components'
import { ScreenHeader } from '@/components/layout'
import { absoluteTime } from '@/lib/time'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { profileOptions } from '@/features/profile/use-profile'
import { useConvo } from './use-convo'
import { useConvoMembers } from './use-convo-members'
import { useChatStatus } from './use-chat-status'
import { useEditGroup } from './use-edit-group'
import { useLeaveConvo } from './use-leave-convo'
import { useLockConvo } from './use-lock-convo'
import { useRemoveGroupMembers } from './use-group-members'
import { AddMembersDialog } from './AddMembersDialog'
import { InviteLinkDialog } from './InviteLinkDialog'
import { JoinRequestsSection } from './JoinRequestsSection'
import { groupKind, memberName, roleOf, viewerOwnsGroup, type ConvoMember } from './group'
import './chat.css'

export default function GroupSettingsScreen() {
  const { convoId } = useParams<{ convoId: string }>()
  const navigate = useNavigate()
  const { did } = useAgent()

  const convoQ = useConvo(convoId)
  const convo = convoQ.data
  const group = convo ? groupKind(convo) : undefined
  const owner = viewerOwnsGroup(convo, did)

  const membersQ = useConvoMembers(convoId, !!group)
  const { groupMemberLimit } = useChatStatus()

  const leave = useLeaveConvo(convoId!)
  const lock = useLockConvo(convoId!)
  const [addOpen, setAddOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const existingDids = useMemo(
    () => new Set(membersQ.members.map((m) => m.did)),
    [membersQ.members],
  )
  // Owner first, then viewer, then the rest — a stable, scannable order.
  const sortedMembers = useMemo(() => {
    const rank = (m: ConvoMember) => (roleOf(m) === 'owner' ? 0 : m.did === did ? 1 : 2)
    return [...membersQ.members].sort((a, b) => rank(a) - rank(b))
  }, [membersQ.members, did])

  if (convoQ.isLoading) {
    return (
      <div className="group-settings">
        <ScreenHeader title="Group settings" showBack />
        <div className="group-settings__center">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  if (convoQ.isError || !convo) {
    return (
      <div className="group-settings">
        <ScreenHeader title="Group settings" showBack />
        <div className="group-settings__center">
          <ErrorState error={convoQ.error} onRetry={() => convoQ.refetch()} title="Couldn’t load group" />
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="group-settings">
        <ScreenHeader title="Conversation" showBack />
        <div className="group-settings__center">
          <EmptyState title="Not a group chat" message="This conversation has no group settings." />
        </div>
      </div>
    )
  }

  const lockStatus = group.lockStatus
  const locked = lockStatus !== 'unlocked'
  const permanentlyLocked = lockStatus === 'locked-permanently'
  const remaining = groupMemberLimit > 0 ? groupMemberLimit - group.memberCount : 0

  const onLeave = () => {
    if (!confirm(owner ? 'Leave and lock this group?' : 'Leave this group chat?')) return
    leave.mutate(undefined, { onSuccess: () => navigate('/messages') })
  }

  return (
    <div className="group-settings">
      <ScreenHeader title="Group settings" showBack />

      <div className="group-settings__scroll">
        {/* Header card */}
        <div className="group-settings__header">
          <AvatarGroup members={convo.members} size="lg" max={4} />
          <GroupName convoId={convoId!} name={group.name} canEdit={owner} />
          <div className="group-settings__meta">
            {group.memberCount} members · created {absoluteTime(group.createdAt)}
            {locked && <> · {permanentlyLocked ? 'ended' : 'locked'}</>}
          </div>
        </div>

        {/* Owner: pending join requests */}
        {owner && <JoinRequestsSection convoId={convoId!} count={group.joinRequestCount ?? 0} />}

        {/* Owner actions */}
        {owner && (
          <div className="group-settings__actions">
            <Button variant="secondary" onClick={() => setAddOpen(true)} disabled={locked}>
              Add members
            </Button>
            <Button variant="secondary" onClick={() => setInviteOpen(true)}>
              Invite link
            </Button>
            {!permanentlyLocked && (
              <Button
                variant="secondary"
                loading={lock.isPending}
                onClick={() => lock.mutate(!locked)}
              >
                {locked ? 'Unlock chat' : 'Lock chat'}
              </Button>
            )}
          </div>
        )}

        <Button variant="danger" onClick={onLeave} loading={leave.isPending}>
          {owner ? 'Leave & lock group' : 'Leave group'}
        </Button>

        {/* Member roster */}
        <div className="group-settings__section">
          <div className="group-settings__section-title">Members</div>
          {membersQ.isLoading ? (
            <div className="group-settings__center">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="member-list">
              {sortedMembers.map((m) => (
                <MemberRow
                  key={m.did}
                  member={m}
                  convoId={convoId!}
                  isSelf={m.did === did}
                  viewerIsOwner={owner}
                />
              ))}
              {membersQ.hasNextPage && (
                <button
                  type="button"
                  className="member-list__more"
                  onClick={() => membersQ.fetchNextPage()}
                  disabled={membersQ.isFetchingNextPage}
                >
                  {membersQ.isFetchingNextPage ? 'Loading…' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <AddMembersDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        convoId={convoId!}
        existingDids={existingDids}
        remaining={remaining}
      />
      <InviteLinkDialog open={inviteOpen} onClose={() => setInviteOpen(false)} convo={convo} />
    </div>
  )
}

/** Inline-editable group name (owner) or static text. */
function GroupName({ convoId, name, canEdit }: { convoId: string; name: string; canEdit: boolean }) {
  const edit = useEditGroup(convoId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  if (!canEdit) return <h1 className="group-settings__name">{name}</h1>

  if (!editing) {
    return (
      <button
        type="button"
        className="group-settings__name group-settings__name--editable"
        onClick={() => {
          setDraft(name)
          setEditing(true)
        }}
        title="Rename group"
      >
        {name}
        <span className="group-settings__name-edit">Edit</span>
      </button>
    )
  }

  const save = () => {
    const next = draft.trim()
    if (!next || next === name) {
      setEditing(false)
      return
    }
    edit.mutate(next, { onSuccess: () => setEditing(false) })
  }

  return (
    <div className="group-settings__rename">
      <input
        className="group-create__input"
        value={draft}
        autoFocus
        maxLength={100}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
      <Button variant="primary" size="sm" loading={edit.isPending} onClick={save}>
        Save
      </Button>
    </div>
  )
}

function MemberRow({
  member,
  convoId,
  isSelf,
  viewerIsOwner,
}: {
  member: ConvoMember
  convoId: string
  isSelf: boolean
  viewerIsOwner: boolean
}) {
  const navigate = useNavigate()
  const { agent } = useAgent()
  const remove = useRemoveGroupMembers(convoId)
  const role = roleOf(member)
  const name = memberName(member)
  // Owner can remove anyone except themselves and other owners.
  const canRemove = viewerIsOwner && !isSelf && role !== 'owner'

  // Warm the member's profile on visibility — matches the exact key ProfileScreen
  // reads (route actor = handle ?? did, same as the link target).
  const actorRef = member.handle ?? member.did
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const opts = profileOptions(agent, actorRef)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
  })

  const items = [
    {
      key: 'profile',
      label: 'View profile',
      onSelect: () => navigate(`/profile/${member.handle ?? member.did}`),
    },
    ...(canRemove
      ? [
          {
            key: 'remove',
            label: 'Remove from group',
            danger: true,
            onSelect: () => {
              if (confirm(`Remove ${name} from the group?`)) remove.mutate([member.did])
            },
          },
        ]
      : []),
  ]

  return (
    <div className="member-row">
      <Link ref={prefetchRef} to={`/profile/${actorRef}`} className="member-row__main">
        <Avatar src={member.avatar} alt={name} fallback={name} size="sm" />
        <span className="member-row__name">
          <strong>{member.displayName?.trim() || member.handle || member.did}</strong>
          {member.handle && <span className="member-row__handle">@{member.handle}</span>}
        </span>
      </Link>
      {role === 'owner' && <span className="member-row__badge">Owner</span>}
      <Menu trigger={<span className="member-row__menu">⋯</span>} items={items} />
    </div>
  )
}
