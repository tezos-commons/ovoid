import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar, Button } from '@/components'
import { RichText } from '@/lib/rich-text'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { useFollow } from './use-follow'
import { profileOptions } from './use-profile'

/**
 * One account row (avatar / name / handle / bio + Follow), used by every
 * actor list — followers, following, liked-by, reposted-by. Warms the target
 * profile once the row dwells in view. `onNavigate` lets a modal host close
 * itself on tap; routed hosts omit it.
 */
export function PersonRow({
  person: p,
  onNavigate,
}: {
  person: AppBskyActorDefs.ProfileView
  onNavigate?: () => void
}) {
  const { agent } = useAgent()
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const opts = profileOptions(agent, p.handle || p.did)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
  })
  return (
    <Link
      ref={prefetchRef}
      to={`/profile/${p.handle || p.did}`}
      className="personrow"
      onClick={onNavigate}
    >
      <Avatar src={p.avatar} alt={p.displayName || p.handle} size="md" />
      <div className="personrow__body">
        <div className="personrow__name">{p.displayName || p.handle}</div>
        <div className="personrow__handle">@{p.handle}</div>
        {p.description && (
          <div className="personrow__bio">
            <RichText text={p.description} />
          </div>
        )}
      </div>
      <PersonFollowButton person={p} />
    </Link>
  )
}

/**
 * Per-row follow / unfollow control. Hidden for the viewer's own row and when
 * signed out. Keeps the follow-record uri in local state (seeded from the list
 * data) so the label flips immediately and a repeat tap toggles correctly — the
 * list query itself isn't patched by the mutation. Stops the click from reaching
 * the row Link (which would navigate / close the host).
 */
function PersonFollowButton({ person }: { person: AppBskyActorDefs.ProfileView }) {
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
      className="personrow__follow"
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
