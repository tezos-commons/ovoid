import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  type AppBskyFeedDefs,
} from '@atproto/api'
import { EmptyState, ErrorState, FeedSkeleton, InfiniteList, PostCard, Icons } from '@/components'
import { ScreenHeader, useHideMobileTopBar } from '@/components/layout'
import { useQuotes, usePostUri } from './use-post-interactions'

/**
 * /profile/:actor/post/:rkey/quotes — posts quoting this post.
 *
 * Quotes the author has detached come back with a `viewDetached` record embed
 * (the quoting post still exists, but the quote of *our* post was removed); they
 * carry no content to show, so we drop them — matching the official client.
 */
export default function PostQuotes() {
  const { actor = '', rkey = '' } = useParams()
  const uriQ = usePostUri(actor, rkey)
  const uri = uriQ.data
  const q = useQuotes(uri)
  const posts = useMemo(
    () => (q.data?.pages.flatMap((p) => p.posts) ?? []).filter((p) => !isDetached(p)),
    [q.data],
  )

  useHideMobileTopBar()

  return (
    <>
      <ScreenHeader title="Quotes" showBack />
      {uriQ.isLoading || q.isLoading ? (
        <FeedSkeleton />
      ) : uriQ.isError || q.isError ? (
        <ErrorState
          error={uriQ.error ?? q.error}
          onRetry={() => (uriQ.isError ? uriQ.refetch() : q.refetch())}
        />
      ) : (
        <InfiniteList<AppBskyFeedDefs.PostView>
          items={posts}
          getKey={(p) => p.uri}
          estimateSize={140}
          scrollKey={`quotes:${actor}/${rkey}`}
          hasNextPage={q.hasNextPage}
          isFetchingNextPage={q.isFetchingNextPage}
          fetchNextPage={q.fetchNextPage}
          emptyState={
            <EmptyState icon={<Icons.HashIcon size={32} />} title="No quotes yet" />
          }
          renderItem={(p) => <PostCard post={p} />}
        />
      )}
    </>
  )
}

/** True when the post's quote of *our* post has been detached by its author. */
function isDetached(post: AppBskyFeedDefs.PostView): boolean {
  const embed = post.embed
  if (AppBskyEmbedRecord.isView(embed)) return AppBskyEmbedRecord.isViewDetached(embed.record)
  if (AppBskyEmbedRecordWithMedia.isView(embed))
    return AppBskyEmbedRecord.isViewDetached(embed.record.record)
  return false
}
