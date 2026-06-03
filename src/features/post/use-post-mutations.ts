import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { patchPostInAllFeeds } from '@/lib/optimistic'

/**
 * Optimistic like + repost for any post, anywhere it is rendered.
 *
 * Invariant: the existence of a like/repost *record* (its AT-URI lives in
 * post.viewer.like / .repost) must stay consistent with the displayed count.
 * We patch the cached PostView immutably via patchPostInAllFeeds — never
 * invalidating the patched feed, which would refetch and jitter the virtualized
 * scroll position.
 *
 * Undo needs the record URI (viewer.like/viewer.repost), NOT the post URI;
 * agent.like/repost want post uri + cid. We optimistically stamp a sentinel URI
 * so the toggle reads active immediately, then reconcile with the real URI from
 * the create call so a subsequent undo deletes the right record.
 */

const OPTIMISTIC_URI = 'optimistic://pending'

function applyLike(active: boolean, recordUri?: string) {
  return (post: AppBskyFeedDefs.PostView): AppBskyFeedDefs.PostView => {
    const count = post.likeCount ?? 0
    return {
      ...post,
      likeCount: Math.max(0, count + (active ? 1 : -1)),
      viewer: { ...post.viewer, like: active ? (recordUri ?? OPTIMISTIC_URI) : undefined },
    }
  }
}

function applyRepost(active: boolean, recordUri?: string) {
  return (post: AppBskyFeedDefs.PostView): AppBskyFeedDefs.PostView => {
    const count = post.repostCount ?? 0
    return {
      ...post,
      repostCount: Math.max(0, count + (active ? 1 : -1)),
      viewer: { ...post.viewer, repost: active ? (recordUri ?? OPTIMISTIC_URI) : undefined },
    }
  }
}

interface ActOnPostArgs {
  uri: string
  cid: string
  recordUri?: string
}

export function usePostMutations() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()

  const like = useMutation({
    mutationFn: async ({ uri, cid, recordUri }: ActOnPostArgs) => {
      if (recordUri && recordUri !== OPTIMISTIC_URI) {
        await agent.deleteLike(recordUri)
        return { recordUri: undefined }
      }
      const res = await agent.like(uri, cid)
      return { recordUri: res.uri }
    },
    onMutate: async ({ uri, recordUri }) => {
      const becomingActive = !recordUri || recordUri === OPTIMISTIC_URI
      await qc.cancelQueries({ queryKey: ['bsky', did, 'feed'] })
      patchPostInAllFeeds(qc, did, uri, applyLike(becomingActive))
      return { uri, becomingActive }
    },
    onSuccess: (result, { uri }) => {
      patchPostInAllFeeds(qc, did, uri, (post) => ({
        ...post,
        viewer: { ...post.viewer, like: result.recordUri },
      }))
    },
    onError: (_e, { uri }, ctx) => {
      if (!ctx) return
      patchPostInAllFeeds(qc, did, uri, applyLike(!ctx.becomingActive))
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
    onMutate: async ({ uri, recordUri }) => {
      const becomingActive = !recordUri || recordUri === OPTIMISTIC_URI
      await qc.cancelQueries({ queryKey: ['bsky', did, 'feed'] })
      patchPostInAllFeeds(qc, did, uri, applyRepost(becomingActive))
      return { uri, becomingActive }
    },
    onSuccess: (result, { uri }) => {
      patchPostInAllFeeds(qc, did, uri, (post) => ({
        ...post,
        viewer: { ...post.viewer, repost: result.recordUri },
      }))
    },
    onError: (_e, { uri }, ctx) => {
      if (!ctx) return
      patchPostInAllFeeds(qc, did, uri, applyRepost(!ctx.becomingActive))
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
