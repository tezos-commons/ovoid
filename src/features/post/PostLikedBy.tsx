import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ActorListScreen } from './ActorListScreen'
import { useLikedBy, usePostUri } from './use-post-interactions'

/** /profile/:actor/post/:rkey/liked-by — accounts that liked the post. */
export default function PostLikedBy() {
  const { actor = '', rkey = '' } = useParams()
  const uriQ = usePostUri(actor, rkey)
  const uri = uriQ.data
  const q = useLikedBy(uri)
  const people = useMemo(() => q.data?.pages.flatMap((p) => p.likes.map((l) => l.actor)) ?? [], [q.data])

  return (
    <ActorListScreen
      title="Liked by"
      people={people}
      isLoading={uriQ.isLoading || q.isLoading}
      isError={uriQ.isError || q.isError}
      error={uriQ.error ?? q.error}
      refetch={() => (uriQ.isError ? uriQ.refetch() : q.refetch())}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={q.fetchNextPage}
      emptyTitle="No likes yet"
      scrollKey={`liked-by:${actor}/${rkey}`}
    />
  )
}
