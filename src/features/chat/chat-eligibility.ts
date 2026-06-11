import type { AppBskyActorDefs } from '@atproto/api'

type AnyProfile =
  | AppBskyActorDefs.ProfileViewBasic
  | AppBskyActorDefs.ProfileView
  | AppBskyActorDefs.ProfileViewDetailed

/**
 * Chat eligibility, derived from the target's chat declaration — the same rules
 * the server enforces, so we can flag ineligible people in the picker instead of
 * letting createGroup/addMembers fail opaquely ("recipient has not enabled being
 * in groups") without naming who.
 *
 * allowIncoming / allowGroupInvites default to 'following' when unset; the
 * 'following' case requires that the target follows the viewer (viewer.followedBy).
 * Ported from upstream social-app's components/dms/util.ts.
 */
export function canBeMessaged(profile: AnyProfile): boolean {
  switch (profile.associated?.chat?.allowIncoming) {
    case 'none':
      return false
    case 'all':
      return true
    case 'following':
    case undefined:
      return Boolean(profile.viewer?.followedBy)
    default:
      return false
  }
}

export function canBeAddedToGroup(profile: AnyProfile): boolean {
  switch (profile.associated?.chat?.allowGroupInvites) {
    case 'none':
      return false
    case 'all':
      return true
    case 'following':
      return Boolean(profile.viewer?.followedBy)
    case undefined:
      // No group-specific declaration → fall back to the DM-incoming policy.
      return canBeMessaged(profile)
    default:
      return false
  }
}

/**
 * Tri-state group eligibility. We only block a pick on a DEFINITIVE 'no' — if the
 * profile carries no chat declaration AND no viewer relation, we can't tell (some
 * search payloads omit them), so we return 'unknown' and let the server decide
 * rather than falsely blocking a valid recipient.
 */
export function groupEligibility(profile: AnyProfile): 'yes' | 'no' | 'unknown' {
  if (!profile.associated?.chat && profile.viewer === undefined) return 'unknown'
  return canBeAddedToGroup(profile) ? 'yes' : 'no'
}

/** Short label for a profile (display name or @handle), for warnings. */
export function profileLabel(profile: AnyProfile): string {
  return profile.displayName?.trim() || `@${profile.handle}`
}
