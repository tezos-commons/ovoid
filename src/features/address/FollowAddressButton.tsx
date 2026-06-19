import { Button } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useIsFollowingTezos, useFollowTezos } from './use-follow-tezos'

/**
 * Follow control for a Tezos address (graph.ovoid.at). Only rendered for a
 * signed-in viewer — following needs the caller's service-auth token.
 *
 * The graph API is follow-only (idempotent POST + an isFollowing GET); there is
 * no unfollow endpoint, so once followed the button shows a settled "Following"
 * state rather than a toggle.
 */
export function FollowAddressButton({ address }: { address: string }) {
  const { isAuthed } = useAgent()
  const following = useIsFollowingTezos(address)
  const follow = useFollowTezos(address)

  if (!isAuthed) return null

  if (following.data) {
    return (
      <Button variant="secondary" size="sm" disabled>
        Following
      </Button>
    )
  }

  return (
    <Button
      variant="primary"
      size="sm"
      loading={follow.isPending}
      // Avoid a Follow→(briefly)→Follow flash before the initial check resolves.
      disabled={following.isLoading}
      onClick={() => follow.mutate()}
    >
      Follow
    </Button>
  )
}
