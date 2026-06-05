import type { Notification, NotifReason } from './use-notifications'

/** Reasons that cluster (avatars stacked, one action icon, subject preview). */
const CLUSTERED_REASONS: ReadonlySet<string> = new Set([
  'like',
  'repost',
  'follow',
  'like-via-repost',
  'repost-via-repost',
  'starterpack-joined',
])

/** Reasons that render as a full PostCard (the notification IS a post). The
 *  notification's own uri is the post; `subscribed-post` is the "new post from a
 *  user you've subscribed to" alert (the profile bell). */
const POSTCARD_REASONS: ReadonlySet<string> = new Set([
  'reply',
  'mention',
  'quote',
  'subscribed-post',
])

export function isPostCardReason(reason: string): boolean {
  return POSTCARD_REASONS.has(reason)
}

/**
 * A clustered group: N authors performed the same action (`reason`) on the same
 * subject (`subjectUri`). `follow`/`starterpack-joined` have no subject, so they
 * cluster purely by reason within a contiguous run.
 */
export interface ClusterGroup {
  kind: 'cluster'
  key: string
  reason: NotifReason
  subjectUri?: string
  authors: Notification['author'][]
  /** Newest indexedAt across the members (drives the timestamp). */
  latestAt: string
  /** Any member unread → the whole cluster shows the unread tint. */
  isRead: boolean
}

/** A single notification that should render as a full post card (reply/mention/quote). */
export interface PostGroup {
  kind: 'post'
  key: string
  reason: NotifReason
  notif: Notification
  /** AT-URI of the post to render (the notification's own subject record). */
  postUri: string
  isRead: boolean
}

export type NotifGroup = ClusterGroup | PostGroup

/**
 * Group a flat, reverse-chronological notification list.
 *
 * Algorithm (single pass, O(n)): walk newest→oldest and key every clustered
 * reason by (reason, subjectUri). All notifications sharing a key fold into one
 * group *regardless of position* — so `like A, reply, like A` collapses the two
 * likes into a single "Alice and Bob liked your post" row, not two rows split by
 * the reply. PostCard reasons (reply/mention/quote) are never merged; each emits
 * its own group in place.
 *
 * Ordering stays correct: a cluster is appended to `out` at its first (= newest,
 * since we walk newest→oldest) member, fixing its position; later folds only add
 * strictly-older members, so a group's `latestAt` never rises after creation and
 * `out` remains sorted by newest-member descending.
 */
export function groupNotifications(notifs: Notification[]): NotifGroup[] {
  const out: NotifGroup[] = []
  // (reason, subjectUri) -> the group collecting its authors. Spans the whole
  // list, so non-contiguous matches still merge.
  const clusters = new Map<string, ClusterGroup>()

  for (const n of notifs) {
    const reason = n.reason as string

    if (POSTCARD_REASONS.has(reason)) {
      out.push({
        kind: 'post',
        key: n.uri,
        reason: n.reason as NotifReason,
        notif: n,
        // For reply/mention/quote the notification's own record is the post;
        // its URI is the post URI.
        postUri: n.uri,
        isRead: n.isRead,
      })
      continue
    }

    if (CLUSTERED_REASONS.has(reason)) {
      const subjectUri = n.reasonSubject
      const key = `${reason}:${subjectUri ?? 'none'}`
      const open = clusters.get(key)
      if (open) {
        open.authors.push(n.author)
        if (n.indexedAt > open.latestAt) open.latestAt = n.indexedAt
        open.isRead = open.isRead && n.isRead
      } else {
        const group: ClusterGroup = {
          kind: 'cluster',
          key,
          reason: n.reason as NotifReason,
          subjectUri,
          authors: [n.author],
          latestAt: n.indexedAt,
          isRead: n.isRead,
        }
        clusters.set(key, group)
        out.push(group)
      }
      continue
    }

    // Unknown/other reason (verified, unverified, …): render as a one-author
    // cluster so nothing is silently dropped. Keyed by URI so these never merge.
    out.push({
      kind: 'cluster',
      key: `${reason}:${n.uri}`,
      reason: n.reason as NotifReason,
      subjectUri: n.reasonSubject,
      authors: [n.author],
      latestAt: n.indexedAt,
      isRead: n.isRead,
    })
  }

  return out
}

/** Collect the URIs of post-card notifications (reply/mention/quote). These are
 *  hydrated via getPosts so the rendered card carries its embed *view* (images,
 *  quoted post) — the raw notification record only holds blob refs, not a view. */
export function collectPostUris(groups: NotifGroup[]): string[] {
  const set = new Set<string>()
  for (const g of groups) {
    if (g.kind === 'post') set.add(g.postUri)
  }
  return [...set]
}

/** Collect the distinct subject URIs of clustered like/repost groups for hydration. */
export function collectSubjectUris(groups: NotifGroup[]): string[] {
  const set = new Set<string>()
  for (const g of groups) {
    if (
      g.kind === 'cluster' &&
      g.subjectUri &&
      (g.reason === 'like' ||
        g.reason === 'repost' ||
        g.reason === 'like-via-repost' ||
        g.reason === 'repost-via-repost')
    ) {
      set.add(g.subjectUri)
    }
  }
  return [...set]
}
