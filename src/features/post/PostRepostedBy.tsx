import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ActorListScreen } from './ActorListScreen'
import { useRepostedBy, usePostUri } from './use-post-interactions'

/** /profile/:actor/post/:rkey/reposted-by — accounts that reposted the post. */
export default function PostRepostedBy() {
  const { actor = '', rkey = '' } = useParams()
  const uriQ = usePostUri(actor, rkey)
  const uri = uriQ.data
  const q = useRepostedBy(uri)
  const people = useMemo(() => q.data?.pages.flatMap((p) => p.repostedBy) ?? [], [q.data])

  return (
    <ActorListScreen
      title="Reposted by"
      people={people}
      isLoading={uriQ.isLoading || q.isLoading}
      isError={uriQ.isError || q.isError}
      error={uriQ.error ?? q.error}
      refetch={() => (uriQ.isError ? uriQ.refetch() : q.refetch())}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={q.fetchNextPage}
      emptyTitle="No reposts yet"
      scrollKey={`reposted-by:${actor}/${rkey}`}
    />
  )
}
