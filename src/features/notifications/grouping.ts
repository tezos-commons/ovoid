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

/** Reasons that render as a full PostCard (the notification IS a post). */
const POSTCARD_REASONS: ReadonlySet<string> = new Set([
  'reply',
  'mention',
  'quote',
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
 * Algorithm (single pass, O(n)): walk newest→oldest. For a clustered reason,
 * fold into the *current open cluster* iff it has the same (reason, subjectUri);
 * otherwise flush and open a new one. PostCard reasons always flush the open
 * cluster and emit a standalone group. This preserves chronological order while
 * collapsing the common "Alice, Bob and 3 others liked your post" run.
 *
 * We only fold *contiguous* runs — a like, then a reply, then a like will NOT
 * merge the two likes. That matches Bluesky and keeps the merged timestamp
 * honest.
 */
export function groupNotifications(notifs: Notification[]): NotifGroup[] {
  const out: NotifGroup[] = []
  let open: ClusterGroup | null = null

  const flush = () => {
    if (open) {
      out.push(open)
      open = null
    }
  }

  for (const n of notifs) {
    const reason = n.reason as string

    if (POSTCARD_REASONS.has(reason)) {
      flush()
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
      const matches =
        open != null &&
        open.reason === reason &&
        open.subjectUri === subjectUri
      if (matches && open) {
        open.authors.push(n.author)
        if (n.indexedAt > open.latestAt) open.latestAt = n.indexedAt
        open.isRead = open.isRead && n.isRead
      } else {
        flush()
        open = {
          kind: 'cluster',
          key: `${reason}:${subjectUri ?? 'none'}:${n.uri}`,
          reason: n.reason as NotifReason,
          subjectUri,
          authors: [n.author],
          latestAt: n.indexedAt,
          isRead: n.isRead,
        }
      }
      continue
    }

    // Unknown/other reason (verified, unverified, …): render as a one-author
    // cluster so nothing is silently dropped.
    flush()
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

  flush()
  return out
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
