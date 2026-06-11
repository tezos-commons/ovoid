import { useState } from 'react'
import type { ChatBskyConvoDefs } from '@atproto/api'

/** Resolve a referred user's DID to a short display label. */
export type NameFor = (did: string) => string

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

/**
 * Human description of a system message from its structured `data` union. The
 * lexicon carries only DIDs (SystemMessageReferredUser), so names are resolved
 * via `nameFor`, falling back to a shortened DID for members not in the partial
 * convo roster.
 */
export function describeSystemMessage(
  msg: ChatBskyConvoDefs.SystemMessageView,
  nameFor: NameFor,
): string {
  const data = msg.data as { $type?: string } & Record<string, unknown>
  const who = (u: unknown): string => {
    const did = (u as { did?: string } | undefined)?.did
    return did ? nameFor(did) : 'Someone'
  }
  switch (data.$type) {
    case 'chat.bsky.convo.defs#systemMessageDataAddMember':
      return `${who(data.member)} was added by ${who(data.addedBy)}`
    case 'chat.bsky.convo.defs#systemMessageDataRemoveMember':
      return `${who(data.member)} was removed`
    case 'chat.bsky.convo.defs#systemMessageDataMemberJoin':
      return `${who(data.member)} joined`
    case 'chat.bsky.convo.defs#systemMessageDataMemberLeave':
      return `${who(data.member)} left`
    case 'chat.bsky.convo.defs#systemMessageDataLockConvo':
      return 'Chat locked'
    case 'chat.bsky.convo.defs#systemMessageDataUnlockConvo':
      return 'Chat unlocked'
    case 'chat.bsky.convo.defs#systemMessageDataLockConvoPermanently':
      return 'Chat ended'
    case 'chat.bsky.convo.defs#systemMessageDataEditGroup': {
      const newName = (data.newName as string | undefined)?.trim()
      return newName ? `Renamed to “${newName}”` : 'Group renamed'
    }
    case 'chat.bsky.convo.defs#systemMessageDataCreateJoinLink':
      return 'Invite link created'
    case 'chat.bsky.convo.defs#systemMessageDataEditJoinLink':
      return 'Invite link updated'
    case 'chat.bsky.convo.defs#systemMessageDataEnableJoinLink':
      return 'Invite link enabled'
    case 'chat.bsky.convo.defs#systemMessageDataDisableJoinLink':
      return 'Invite link disabled'
    default:
      return 'Conversation updated'
  }
}

export interface SystemMessageProps {
  msgs: ChatBskyConvoDefs.SystemMessageView[]
  /** When true, a run is collapsed behind an expandable summary toggle. */
  collapsed: boolean
  nameFor: NameFor
}

/**
 * Renders a single system line, or a collapsed run as an expandable summary
 * ("N updates") that reveals each line on toggle.
 */
export function SystemMessage({ msgs, collapsed, nameFor }: SystemMessageProps) {
  const [open, setOpen] = useState(false)

  if (!collapsed) {
    return (
      <div className="msg-system">
        <span>{describeSystemMessage(msgs[0], nameFor)}</span>
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
            <span key={m.id} className="msg-system__line">
              {describeSystemMessage(m, nameFor)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
