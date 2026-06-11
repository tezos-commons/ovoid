import type { ChatBskyActorDefs, ChatBskyConvoDefs } from '@atproto/api'

/**
 * Group-vs-DM discrimination and member-role helpers.
 *
 * The convo lexicon models 1:1 and group chats in one `ConvoView`, distinguished
 * by the `kind` union (`directConvo` | `groupConvo`). Ovoid's chat UI predates
 * groups and assumed the 1:1 shape (other-member = members[0]); these helpers
 * centralize the branch so every surface derives title/avatar/role identically.
 *
 * Note on rosters: for a group, `convo.members` is NOT the full member list — the
 * lexicon returns only "important" members (viewer, last sender, adder, a few
 * others). The viewer IS always among them, so viewer-role checks off
 * `convo.members` are sound; the complete roster comes from getConvoMembers.
 */

const GROUP_CONVO = 'chat.bsky.convo.defs#groupConvo'
const GROUP_MEMBER = 'chat.bsky.actor.defs#groupConvoMember'

export type ConvoMember = ChatBskyConvoDefs.ConvoView['members'][number]

/** The narrowed group metadata, or undefined for a 1:1 convo. */
export function groupKind(
  convo: ChatBskyConvoDefs.ConvoView,
): ChatBskyConvoDefs.GroupConvo | undefined {
  const kind = convo.kind
  return kind && kind.$type === GROUP_CONVO
    ? (kind as ChatBskyConvoDefs.GroupConvo)
    : undefined
}

export function isGroup(convo: ChatBskyConvoDefs.ConvoView): boolean {
  return groupKind(convo) !== undefined
}

/** The non-viewer participant of a 1:1 convo (falls back to members[0]). */
export function otherMember(
  convo: ChatBskyConvoDefs.ConvoView,
  viewerDid: string | undefined,
): ConvoMember | undefined {
  const others = convo.members.filter((m) => m.did !== viewerDid)
  return others[0] ?? convo.members[0]
}

/** Display title: group name for groups, the other member's name for DMs. */
export function convoTitle(
  convo: ChatBskyConvoDefs.ConvoView,
  viewerDid: string | undefined,
): string {
  const g = groupKind(convo)
  if (g) return g.name?.trim() || 'Group chat'
  const other = otherMember(convo, viewerDid)
  return other?.displayName?.trim() || (other?.handle ? `@${other.handle}` : 'Unknown')
}

/** A member's role within a group, or undefined outside a group context. */
export function roleOf(member: ConvoMember): ChatBskyActorDefs.MemberRole | undefined {
  const k = member.kind
  return k && k.$type === GROUP_MEMBER
    ? (k as ChatBskyActorDefs.GroupConvoMember).role
    : undefined
}

export function isOwner(member: ConvoMember): boolean {
  return roleOf(member) === 'owner'
}

/** The viewer's own role in the convo, read off the (always-present) viewer member. */
export function myRole(
  members: readonly ConvoMember[],
  viewerDid: string | undefined,
): ChatBskyActorDefs.MemberRole | undefined {
  const me = members.find((m) => m.did === viewerDid)
  return me ? roleOf(me) : undefined
}

/** True when the viewer owns the group (gates rename/lock/invite/remove actions). */
export function viewerOwnsGroup(
  convo: ChatBskyConvoDefs.ConvoView | undefined,
  viewerDid: string | undefined,
): boolean {
  if (!convo) return false
  return isGroup(convo) && myRole(convo.members, viewerDid) === 'owner'
}

/** Human label for a member's name. */
export function memberName(member: ConvoMember): string {
  return member.displayName?.trim() || (member.handle ? `@${member.handle}` : member.did)
}
