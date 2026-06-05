import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar, Spinner } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { ProfileCard } from '@/features/profile/ProfileCard'
import { useThreadAuthorProfiles } from './use-thread'
import { useThreadHover } from './thread-hover-store'

/** Max avatars in the grid: 2 rows × 6 columns. */
const GRID_MAX = 12

export interface ThreadAuthorsProps {
  authors: AppBskyActorDefs.ProfileViewBasic[]
  /** The focused post's author — the badge shown by default. */
  focusedDid: string
}

/**
 * The thread's accounts, rendered in the page aside. With a single account it is
 * just that account's profile badge. With several it shows a grid of the most
 * popular (by follower count) accounts above a badge; clicking an avatar swaps
 * the badge to that account.
 */
export function ThreadAuthors({ authors, focusedDid }: ThreadAuthorsProps) {
  const { did, isAuthed } = useAgent()
  const profilesQ = useThreadAuthorProfiles(authors.map((a) => a.did))
  const byDid = profilesQ.data
  const [selectedDid, setSelectedDid] = useState(focusedDid)
  const hoveredDid = useThreadHover((s) => s.hoveredDid)

  // Most popular first, capped to the grid size. Until profiles load, fall back
  // to encounter order so the grid still renders immediately.
  const ranked = useMemo(() => {
    const arr = authors.slice()
    if (byDid) {
      arr.sort(
        (a, b) =>
          (byDid.get(b.did)?.followersCount ?? 0) - (byDid.get(a.did)?.followersCount ?? 0),
      )
    }
    return arr.slice(0, GRID_MAX)
  }, [authors, byDid])

  const selected = byDid?.get(selectedDid)
  const badge = selected ? (
    <ProfileCard profile={selected} actor={selected.did} isSelf={selected.did === did} isAuthed={isAuthed} />
  ) : (
    <div className="threadauthors__loading">
      <Spinner />
    </div>
  )

  // Single account: just the badge, no grid.
  if (authors.length <= 1) {
    return <div className="threadauthors">{badge}</div>
  }

  return (
    <div className="threadauthors">
      <div className="threadauthors__grid">
        {ranked.map((a) => (
          <button
            key={a.did}
            type="button"
            className={clsx(
              'threadauthors__avatar',
              a.did === hoveredDid && 'threadauthors__avatar--hover',
              a.did === selectedDid && 'threadauthors__avatar--active',
            )}
            title={a.displayName || a.handle}
            aria-label={a.displayName || a.handle}
            aria-pressed={a.did === selectedDid}
            onClick={() => setSelectedDid(a.did)}
          >
            <Avatar
              src={a.avatar}
              alt={a.displayName || a.handle}
              fallback={a.displayName || a.handle}
              size="md"
            />
          </button>
        ))}
      </div>
      {badge}
    </div>
  )
}
