import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { Avatar } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { profileOptions } from '@/features/profile/use-profile'

/** Resolve a referred user's DID to a short display label. */
export type NameFor = (did: string) => string
/** Resolve a referred user's DID to an avatar URL, when known. */
export type AvatarFor = (did: string) => string | undefined

/**
 * DIDs a system message refers to (so the thread can resolve their names even
 * when they aren't in the partial convo.members set — e.g. a fresh joiner).
 */
export function referredDids(msg: ChatBskyConvoDefs.SystemMessageView): string[] {
  const data = msg.data as Record<string, unknown>
  const out: string[] = []
  for (const key of ['member', 'addedBy', 'removedBy', 'lockedBy', 'approvedBy']) {
    const did = (data[key] as { did?: string } | undefined)?.did
    if (did) out.push(did)
  }
  return out
}

/** A system line decomposes into literal text and user references. */
type SystemPart = string | { did: string }

/**
 * Structured description of a system message from its `data` union. The lexicon
 * carries only DIDs (SystemMessageReferredUser); user parts are rendered as
 * avatar + name links, plain parts as text.
 */
function systemMessageParts(msg: ChatBskyConvoDefs.SystemMessageView): SystemPart[] {
  const data = msg.data as { $type?: string } & Record<string, unknown>
  const who = (u: unknown): SystemPart => {
    const did = (u as { did?: string } | undefined)?.did
    return did ? { did } : 'Someone'
  }
  switch (data.$type) {
    case 'chat.bsky.convo.defs#systemMessageDataAddMember':
      return [who(data.member), ' was added by ', who(data.addedBy)]
    case 'chat.bsky.convo.defs#systemMessageDataRemoveMember':
      return [who(data.member), ' was removed']
    case 'chat.bsky.convo.defs#systemMessageDataMemberJoin':
      return [who(data.member), ' joined']
    case 'chat.bsky.convo.defs#systemMessageDataMemberLeave':
      return [who(data.member), ' left']
    case 'chat.bsky.convo.defs#systemMessageDataLockConvo':
      return ['Chat locked']
    case 'chat.bsky.convo.defs#systemMessageDataUnlockConvo':
      return ['Chat unlocked']
    case 'chat.bsky.convo.defs#systemMessageDataLockConvoPermanently':
      return ['Chat ended']
    case 'chat.bsky.convo.defs#systemMessageDataEditGroup': {
      const newName = (data.newName as string | undefined)?.trim()
      return [newName ? `Renamed to “${newName}”` : 'Group renamed']
    }
    case 'chat.bsky.convo.defs#systemMessageDataCreateJoinLink':
      return ['Invite link created']
    case 'chat.bsky.convo.defs#systemMessageDataEditJoinLink':
      return ['Invite link updated']
    case 'chat.bsky.convo.defs#systemMessageDataEnableJoinLink':
      return ['Invite link enabled']
    case 'chat.bsky.convo.defs#systemMessageDataDisableJoinLink':
      return ['Invite link disabled']
    default:
      return ['Conversation updated']
  }
}

/**
 * Inline avatar + name linking to the member's profile. Warms the profile
 * query (keyed by DID — exactly what the /profile/:did route reads) once the
 * line scrolls into view.
 */
function SystemUserLink({
  did,
  nameFor,
  avatarFor,
}: {
  did: string
  nameFor: NameFor
  avatarFor: AvatarFor
}) {
  const { agent } = useAgent()
  const ref = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const profile = profileOptions(agent, did)
    schedulePrefetch(profile.queryKey, () => queryClient.prefetchQuery(profile))
  })
  const name = nameFor(did)
  return (
    <Link ref={ref} to={`/profile/${did}`} className="msg-system__user">
      <Avatar src={avatarFor(did)} alt={name} fallback={name} size="xs" />
      <span>{name}</span>
    </Link>
  )
}

function SystemLine({
  msg,
  nameFor,
  avatarFor,
}: {
  msg: ChatBskyConvoDefs.SystemMessageView
  nameFor: NameFor
  avatarFor: AvatarFor
}): ReactNode {
  return systemMessageParts(msg).map((part, i) =>
    typeof part === 'string' ? (
      <Fragment key={i}>{part}</Fragment>
    ) : (
      <SystemUserLink key={i} did={part.did} nameFor={nameFor} avatarFor={avatarFor} />
    ),
  )
}

export interface SystemMessageProps {
  msgs: ChatBskyConvoDefs.SystemMessageView[]
  /** When true, a run is collapsed behind an expandable summary toggle. */
  collapsed: boolean
  nameFor: NameFor
  avatarFor: AvatarFor
}

/**
 * Renders a single system line, or a collapsed run as an expandable summary
 * ("N updates") that reveals each line on toggle.
 */
export function SystemMessage({ msgs, collapsed, nameFor, avatarFor }: SystemMessageProps) {
  const [open, setOpen] = useState(false)

  if (!collapsed) {
    return (
      <div className="msg-system">
        <span className="msg-system__text">
          <SystemLine msg={msgs[0]} nameFor={nameFor} avatarFor={avatarFor} />
        </span>
      </div>
    )
  }

  return (
    <div className="msg-system msg-system--group">
      <button
        type="button"
        className="msg-system__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide' : `${msgs.length} chat updates`}
      </button>
      {open && (
        <div className="msg-system__list">
          {msgs.map((m) => (
            <span key={m.id} className="msg-system__line msg-system__text">
              <SystemLine msg={m} nameFor={nameFor} avatarFor={avatarFor} />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
