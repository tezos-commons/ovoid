import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AppBskyFeedPost,
  type AppBskyFeedDefs,
  type BlobRef,
  type ComAtprotoRepoStrongRef,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { buildPost } from '@/lib/rich-text'
import { uploadImage } from '@/lib/blob'
import type { PendingImage } from '@/features/home/compose/use-create-post'

export interface ReplyArgs {
  /** The post being replied to (the immediate parent). */
  parent: AppBskyFeedDefs.PostView
  text: string
  /** Optional attached images (e.g. pasted into the composer). */
  images?: PendingImage[]
}

function strongRef(post: AppBskyFeedDefs.PostView): ComAtprotoRepoStrongRef.Main {
  return { uri: post.uri, cid: post.cid }
}

/**
 * Resolve the thread-root StrongRef for a reply.
 *
 * Invariant (load-bearing for thread grouping): reply.root must be the THREAD
 * root, not the immediate parent. If the parent is itself a reply, inherit its
 * record.reply.root; otherwise the parent IS the root. Reconstructing this
 * wrong silently breaks thread bucketing on the AppView.
 */
function rootRef(parent: AppBskyFeedDefs.PostView): ComAtprotoRepoStrongRef.Main {
  // isRecord narrows to a $TypedObject (not the Record interface); cast to the
  // Record alias to read reply.root (mirrors use-create-post's handling).
  const rec = AppBskyFeedPost.isRecord(parent.record)
    ? (parent.record as AppBskyFeedPost.Record)
    : null
  if (rec?.reply?.root) {
    return rec.reply.root
  }
  return strongRef(parent)
}

/**
 * Create a reply to a post. Requires an authed agent — the public AppView agent
 * cannot write. Facets are detected (handle->DID resolved) before posting so
 * mentions/links in the reply are live. On success the thread cache is
 * invalidated to splice in the new reply with correct ordering/connectors.
 */
export function useReply() {
  const { agent, isAuthed } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ parent, text: rawText, images }: ReplyArgs) => {
      if (!isAuthed) throw new Error('Sign in to reply')
      const { text, facets } = await buildPost(agent, rawText)

      // Upload any attached images (compressed <1MB by lib/blob) and build the
      // images embed — same shape useCreatePost produces for top-level posts.
      let embed: AppBskyFeedPost.Record['embed'] | undefined
      if (images && images.length > 0) {
        const uploaded = await Promise.all(
          images.map(async (img) => ({
            image: (await uploadImage(agent, img.file)) as BlobRef,
            alt: img.alt,
          })),
        )
        embed = { $type: 'app.bsky.embed.images', images: uploaded }
      }

      const res = await agent.post({
        text,
        facets,
        reply: { root: rootRef(parent), parent: strongRef(parent) },
        createdAt: new Date().toISOString(),
        ...(embed ? { embed } : {}),
      })
      return res
    },
    onSuccess: (_res, { parent }) => {
      // Refetch the thread so the new reply appears in-tree. The root uri (which
      // keys the open ThreadScreen query) may differ from the parent uri, so
      // invalidate the whole thread domain rather than one key.
      void qc.invalidateQueries({ queryKey: ['bsky', 'thread'] })
      // Reply count on the parent lives in every feed that shows it.
      void qc.invalidateQueries({ predicate: (query) => qk.isFeedKey(query.queryKey) })
      void parent
    },
  })
}
