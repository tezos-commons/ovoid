import { Skeleton } from './Skeleton'

/**
 * Layout-faithful skeletons. Each mirrors the geometry of the component it
 * stands in for by reusing the *same* container classes (`.postcard`,
 * `.notif`, `.convo-row`, …) and filling the leaf slots with shimmer blocks.
 *
 * Property preserved: a skeleton occupies the same box the real content will,
 * so data-arrival is an in-place fill rather than a reflow from a centered
 * spinner. Keeping the container classes shared means these track layout
 * changes for free — the geometry lives in one place, the CSS.
 *
 * All are aria-hidden; the live region announcing "loading" is the call site's
 * concern (or none, when the skeleton is brief).
 */

/** A stack of text-line shimmer bars. Widths cycle to read as prose. */
function Lines({ widths, height = 13, gap = 6 }: { widths: (number | string)[]; height?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {widths.map((w, i) => (
        <Skeleton key={i} width={w} height={height} />
      ))}
    </div>
  )
}

/* ============================== Post / feed ============================== */

/** Mirrors PostCard: 42px avatar gutter + head (name·handle) + body + actions. */
export function PostCardSkeleton({ focused = false }: { focused?: boolean }) {
  if (focused) {
    return (
      <article className="postcard postcard--focused postcard--skel" aria-hidden="true">
        <div className="postcard__main">
          <div className="postcard__head" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <Skeleton circle width={42} height={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width={150} height={16} />
              <Skeleton width={100} height={13} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Lines widths={['98%', '92%', '70%']} height={15} />
          </div>
        </div>
      </article>
    )
  }
  return (
    <article className="postcard postcard--skel" aria-hidden="true">
      <div className="postcard__gutter">
        <Skeleton circle width={42} height={42} />
      </div>
      <div className="postcard__main">
        <div className="postcard__head" style={{ gap: 'var(--space-2)' }}>
          <Skeleton width={120} height={14} />
          <Skeleton width={80} height={13} />
        </div>
        <div style={{ marginTop: 6 }}>
          <Lines widths={['95%', '78%']} />
        </div>
        <div style={{ display: 'flex', gap: 56, marginTop: 'var(--space-3)', maxWidth: 360 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} circle width={18} height={18} />
          ))}
        </div>
      </div>
    </article>
  )
}

/** N post-card skeletons. The default fill for any feed/list first load. */
export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  )
}

/* ============================== Thread ============================== */

/** Two parent rows + the enlarged focused post — mirrors ThreadScreen's spine. */
export function ThreadSkeleton() {
  return (
    <div role="status" aria-label="Loading thread">
      <PostCardSkeleton />
      <PostCardSkeleton focused />
      <PostCardSkeleton />
      <PostCardSkeleton />
    </div>
  )
}

/* ============================== Profile header ============================== */

/** Mirrors ProfileCard: banner, overlapping xl avatar, name/handle, bio, counts. */
export function ProfileCardSkeleton() {
  return (
    <header className="profhead" aria-hidden="true">
      <div className="profhead__banner" />
      <div className="profhead__bar">
        <span className="profhead__avatar">
          <Skeleton circle width={96} height={96} />
        </span>
        <div className="profhead__actions" style={{ paddingBottom: 'var(--space-2)' }}>
          <Skeleton width={104} height={34} radius="var(--radius-pill)" />
        </div>
      </div>
      <div className="profhead__identity">
        <Skeleton width={180} height={22} />
        <div style={{ marginTop: 'var(--space-1)' }}>
          <Skeleton width={130} height={14} />
        </div>
      </div>
      <div className="profhead__bio" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="90%" height={14} />
        <Skeleton width="60%" height={14} />
      </div>
      <div className="profhead__counts" style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <Skeleton width={70} height={14} />
        <Skeleton width={70} height={14} />
        <Skeleton width={50} height={14} />
      </div>
    </header>
  )
}

/* ============================== List header ============================== */

/** Mirrors ListHeader: xl rounded-square avatar + name + purpose-by + desc. */
export function ListHeaderSkeleton() {
  return (
    <div className="list-detail__header" aria-hidden="true">
      <div className="list-detail__top">
        <Skeleton width={96} height={96} radius="var(--radius-panel)" />
        <div className="list-detail__heading" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width={200} height={22} />
          <Skeleton width={150} height={14} />
        </div>
      </div>
      <div className="list-detail__desc" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="85%" height={14} />
        <Skeleton width="55%" height={14} />
      </div>
    </div>
  )
}

/* ============================== Notifications ============================== */

/** Mirrors a notification cluster row: icon gutter + stacked avatars + text. */
function NotifRowSkeleton({ avatars = 3 }: { avatars?: number }) {
  return (
    <article className="notif" aria-hidden="true">
      <div className="notif__icon">
        <Skeleton circle width={26} height={26} />
      </div>
      <div className="notif__main">
        <div style={{ display: 'flex' }}>
          {Array.from({ length: avatars }).map((_, i) => (
            <span key={i} style={{ marginRight: 'calc(-1 * var(--space-1))' }}>
              <Skeleton circle width={32} height={32} />
            </span>
          ))}
        </div>
        <Skeleton width="60%" height={14} />
      </div>
    </article>
  )
}

export function NotificationsSkeleton({ count = 8 }: { count?: number }) {
  // Vary the avatar fan so the column doesn't read as a repeating stamp.
  const fans = [3, 1, 5, 2, 4, 1, 3, 2]
  return (
    <div role="status" aria-label="Loading notifications">
      {Array.from({ length: count }).map((_, i) => (
        <NotifRowSkeleton key={i} avatars={fans[i % fans.length]} />
      ))}
    </div>
  )
}

/* ============================== Chat ============================== */

/** Mirrors a convo row: md avatar + name/time + preview. */
export function ConvoListSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading conversations">
      {Array.from({ length: count }).map((_, i) => (
        <div className="convo-row convo-row--skel" key={i} aria-hidden="true">
          <Skeleton circle width={42} height={42} />
          <div className="convo-row__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="80%" height={13} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Alternating L/R chat bubbles of varied width. */
export function MessageThreadSkeleton() {
  // (mine?, width) — a plausible back-and-forth shape.
  const bubbles: [boolean, number][] = [
    [false, 180],
    [false, 90],
    [true, 140],
    [false, 220],
    [true, 200],
    [true, 70],
    [false, 120],
  ]
  return (
    <div
      role="status"
      aria-label="Loading messages"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)' }}
    >
      {bubbles.map(([mine, w], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
          <Skeleton width={w} height={36} radius={18} />
        </div>
      ))}
    </div>
  )
}

/* ============================== People rows ============================== */

/** Mirrors PersonCard: avatar + name/handle (+ bio when not compact). */
export function PersonRowSkeleton({ compact = false }: { compact?: boolean }) {
  const size = compact ? 32 : 42
  return (
    <div className={compact ? 'personrow personrow--compact' : 'personrow'} aria-hidden="true">
      <Skeleton circle width={size} height={size} />
      <div className="personrow__body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="40%" height={15} />
        <Skeleton width="30%" height={13} />
        {!compact && <Skeleton width="75%" height={13} />}
      </div>
    </div>
  )
}

export function PeopleSkeleton({ count = 8, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div role="status" aria-label="Loading people">
      {Array.from({ length: count }).map((_, i) => (
        <PersonRowSkeleton key={i} compact={compact} />
      ))}
    </div>
  )
}

/* ============================== NFT grid ============================== */

/** Mirrors NftGrid: the 6-up (3-up mobile) square thumbnail grid. */
export function NftGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="nftgrid" role="status" aria-label="Loading items">
      <div className="nftgrid__cells">
        {Array.from({ length: count }).map((_, i) => (
          <div className="nftcard" key={i} aria-hidden="true">
            <div className="nftcard__thumb">
              {/* radius 0 so the shimmer fills the thumb; the wrapper clips it. */}
              <Skeleton width="100%" height="100%" radius={0} />
            </div>
            <Skeleton width="70%" height={13} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================== Settings ============================== */

/** Mirrors the account header block: lg avatar + name/handle. */
export function SettingsAccountSkeleton() {
  return (
    <div className="settings-account" aria-hidden="true">
      <Skeleton circle width={80} height={80} />
      <div className="settings-account__meta" style={{ gap: 6 }}>
        <Skeleton width={160} height={16} />
        <Skeleton width={110} height={13} />
      </div>
    </div>
  )
}

/** One settings row: label + sub, with an optional trailing control block. */
function SettingsRowSkeleton({ trailing = false }: { trailing?: boolean }) {
  return (
    <div className="settings-row" aria-hidden="true">
      <div className="settings-row__body">
        <Skeleton width="40%" height={15} />
        <Skeleton width="65%" height={13} />
      </div>
      {trailing && (
        <div className="settings-row__trailing">
          <Skeleton width={72} height={28} radius="var(--radius-pill)" />
        </div>
      )}
    </div>
  )
}

/** N settings rows — the fill for a Section's async list (e.g. app passwords). */
export function SettingsListSkeleton({ count = 3, trailing = false }: { count?: number; trailing?: boolean }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SettingsRowSkeleton key={i} trailing={trailing} />
      ))}
    </div>
  )
}

/** A whole settings screen: labelled sections of rows (e.g. Moderation). */
export function SettingsSkeleton({ sections = 2, rows = 2 }: { sections?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading settings">
      {Array.from({ length: sections }).map((_, s) => (
        <section className="settings-section" key={s} aria-hidden="true">
          <div className="settings-section__title">
            <Skeleton width={120} height={12} />
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <SettingsRowSkeleton key={r} trailing={r % 2 === 0} />
          ))}
        </section>
      ))}
    </div>
  )
}

/** Mirrors a moderation list row: md avatar + name/handle + undo button. */
export function ModListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading accounts">
      {Array.from({ length: count }).map((_, i) => (
        <div className="modlist-row" key={i} aria-hidden="true">
          <div className="modlist-row__main">
            <Skeleton circle width={42} height={42} />
            <div className="modlist-row__meta" style={{ gap: 6, display: 'flex', flexDirection: 'column' }}>
              <Skeleton width={140} height={15} />
              <Skeleton width={90} height={13} />
            </div>
          </div>
          <Skeleton width={72} height={28} radius="var(--radius-pill)" />
        </div>
      ))}
    </div>
  )
}
