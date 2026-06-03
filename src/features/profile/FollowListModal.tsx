import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar, Button, Dialog, Spinner, ErrorState, EmptyState } from '@/components'
import { RichText } from '@/lib/rich-text'
import { useAgent } from '@/lib/api/agent'
import { useCloseOnBack } from '@/lib/use-close-on-back'
import { useFollows, useFollowers } from './use-follow-list'
import { useFollow } from './use-follow'

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
        {q.isLoading && (
          <div className="followlist__center">
            <Spinner />
          </div>
        )}
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {!q.isLoading && !q.isError && people.length === 0 && (
          <EmptyState
            title={mode === 'followers' ? 'No followers yet' : 'Not following anyone'}
          />
        )}

        {people.map((p) => (
          <Link
            key={p.did}
            to={`/profile/${p.handle || p.did}`}
            className="followlist__row"
            onClick={onClose}
          >
            <Avatar src={p.avatar} alt={p.displayName || p.handle} size="md" />
            <div className="followlist__meta">
              <span className="followlist__name">{p.displayName || p.handle}</span>
              <span className="followlist__handle">@{p.handle}</span>
              {p.description && (
                <span className="followlist__bio">
                  <RichText text={p.description} />
                </span>
              )}
            </div>
            <FollowButton person={p} />
          </Link>
        ))}

        <div ref={sentinel} className="followlist__sentinel">
          {q.isFetchingNextPage && <Spinner size="sm" />}
        </div>
      </div>
    </Dialog>
  )
}

/**
 * Per-row follow / unfollow control. Hidden for the viewer's own row and when
 * signed out. Keeps the follow-record uri in local state (seeded from the list
 * data) so the label flips immediately and a repeat tap toggles correctly —
 * the list query itself isn't patched by the mutation. Stops the click from
 * reaching the row Link (which would navigate + close the modal).
 */
function FollowButton({ person }: { person: AppBskyActorDefs.ProfileView }) {
  const { did, isAuthed } = useAgent()
  const follow = useFollow(person.handle || person.did)
  const [followUri, setFollowUri] = useState<string | undefined>(person.viewer?.following)

  if (!isAuthed || person.did === did) return null

  const following = !!followUri
  return (
    <Button
      variant={following ? 'secondary' : 'primary'}
      size="sm"
      loading={follow.isPending}
      className="followlist__follow"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        follow.mutate(
          { ...person, viewer: { ...person.viewer, following: followUri } },
          { onSuccess: (res) => setFollowUri(res.following) },
        )
      }}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  )
}
