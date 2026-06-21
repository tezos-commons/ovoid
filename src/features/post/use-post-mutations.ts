import { useMutation } from '@tanstack/react-query'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { setPostShadow } from '@/store/post-shadow'

/**
 * Optimistic like + repost for any post, anywhere it is rendered.
 *
 * Optimism lives in the post-shadow overlay (src/store/post-shadow.ts), NOT the
 * query cache: a cache patch loses to the next background/thread refetch, which
 * returns AppView data that hasn't indexed the write yet. The shadow is merged
 * on top of cache data at render time, so the viewer's action survives refetches
 * and stays consistent across every surface the post appears in.
 *
 * Undo needs the record URI (viewer.like/viewer.repost), NOT the post URI;
 * agent.like/repost want post uri + cid. We stamp a sentinel URI so the toggle
 * reads active immediately, then reconcile with the real URI from the create
 * call so a subsequent undo deletes the right record.
 */

const OPTIMISTIC_URI = 'optimistic://pending'

interface ActOnPostArgs {
  uri: string
  cid: string
  recordUri?: string
}

export function usePostMutations() {
  const { agent } = useAgent()

  const like = useMutation({
    mutationFn: async ({ uri, cid, recordUri }: ActOnPostArgs) => {
      if (recordUri && recordUri !== OPTIMISTIC_URI) {
        await agent.deleteLike(recordUri)
        return { recordUri: undefined }
      }
      const res = await agent.like(uri, cid)
      return { recordUri: res.uri }
    },
    onMutate: ({ uri, recordUri }) => {
      const becomingActive = !recordUri || recordUri === OPTIMISTIC_URI
      setPostShadow(uri, { likeUri: becomingActive ? OPTIMISTIC_URI : null })
      return { uri, becomingActive }
    },
    onSuccess: (result, { uri }) => {
      setPostShadow(uri, { likeUri: result.recordUri ?? null })
    },
    onError: (_e, { uri }) => {
      // Drop the override so the base (server) state shows again.
      setPostShadow(uri, { likeUri: undefined })
    },
  })

  const repost = useMutation({
    mutationFn: async ({ uri, cid, recordUri }: ActOnPostArgs) => {
      if (recordUri && recordUri !== OPTIMISTIC_URI) {
        await agent.deleteRepost(recordUri)
        return { recordUri: undefined }
      }
      const res = await agent.repost(uri, cid)
      return { recordUri: res.uri }
    },
    onMutate: ({ uri, recordUri }) => {
      const becomingActive = !recordUri || recordUri === OPTIMISTIC_URI
      setPostShadow(uri, { repostUri: becomingActive ? OPTIMISTIC_URI : null })
      return { uri, becomingActive }
    },
    onSuccess: (result, { uri }) => {
      setPostShadow(uri, { repostUri: result.recordUri ?? null })
    },
    onError: (_e, { uri }) => {
      setPostShadow(uri, { repostUri: undefined })
    },
  })

  return {
    toggleLike: (post: AppBskyFeedDefs.PostView) =>
      like.mutate({ uri: post.uri, cid: post.cid, recordUri: post.viewer?.like }),
    toggleRepost: (post: AppBskyFeedDefs.PostView) =>
      repost.mutate({ uri: post.uri, cid: post.cid, recordUri: post.viewer?.repost }),
  }
}

/** Share a post: native share sheet when available, else copy its permalink. */
export async function sharePost(post: AppBskyFeedDefs.PostView): Promise<void> {
  const rkey = post.uri.split('/').pop() ?? ''
  const handle = post.author.handle || post.author.did
  const url = `${window.location.origin}/profile/${handle}/post/${rkey}`
  try {
    if (navigator.share) await navigator.share({ url })
    else await navigator.clipboard.writeText(url)
  } catch {
    /* user cancelled / clipboard blocked — non-fatal */
  }
}
