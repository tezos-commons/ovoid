import { useEffect, useRef } from 'react'
import type { AppBskyActorDefs } from '@atproto/api'
import { Dialog, Spinner, PeopleSkeleton, ErrorState, EmptyState } from '@/components'
import { useCloseOnBack } from '@/lib/use-close-on-back'
import { useFollows, useFollowers } from './use-follow-list'
import { PersonRow } from './PersonRow'

export interface FollowListModalProps {
  actor: string
  mode: 'followers' | 'following'
  open: boolean
  onClose: () => void
}

/**
 * Followers / Following list in a modal. Paginates via an IntersectionObserver
 * sentinel at the bottom of the scroll region (the Dialog body owns the
 * scroll, so a virtualizer isn't needed for these short lists).
 */
export function FollowListModal({ actor, mode, open, onClose }: FollowListModalProps) {
  const followers = useFollowers(actor, { enabled: open && mode === 'followers' })
  const following = useFollows(actor, { enabled: open && mode === 'following' })
  const q = mode === 'followers' ? followers : following

  // Back button / back-swipe closes the list instead of leaving the profile.
  useCloseOnBack(open, onClose)

  const people: AppBskyActorDefs.ProfileView[] = q.data
    ? mode === 'followers'
      ? (q.data.pages as { followers: AppBskyActorDefs.ProfileView[] }[]).flatMap((p) => p.followers)
      : (q.data.pages as { follows: AppBskyActorDefs.ProfileView[] }[]).flatMap((p) => p.follows)
    : []

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
        q.fetchNextPage()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage, people.length])

  return (
    <Dialog open={open} onClose={onClose} title={mode === 'followers' ? 'Followers' : 'Following'}>
      <div className="followlist">
        {q.isLoading && <PeopleSkeleton count={6} />}
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {!q.isLoading && !q.isError && people.length === 0 && (
          <EmptyState
            title={mode === 'followers' ? 'No followers yet' : 'Not following anyone'}
          />
        )}

        {people.map((p) => (
          <PersonRow key={p.did} person={p} onNavigate={onClose} />
        ))}

        <div ref={sentinel} className="followlist__sentinel">
          {q.isFetchingNextPage && <Spinner size="sm" />}
        </div>
      </div>
    </Dialog>
  )
}
