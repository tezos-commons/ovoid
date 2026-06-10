import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AppBskyFeedPost,
  type AppBskyFeedDefs,
  type BlobRef,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { bumpReplyCount, patchPostInAllFeeds } from '@/lib/optimistic'
import { buildPost } from '@/lib/rich-text'
import { uploadImage } from '@/lib/blob'
import type { ComposeTarget } from '@/store/compose-store'

export interface PendingImage {
  file: File
  /** Object URL for the preview thumbnail. */
  url: string
  alt: string
}

export interface CreatePostArgs {
  text: string
  images: PendingImage[]
  target: ComposeTarget
}

type StrongRef = { uri: string; cid: string }

type InfiniteShape = { pages: unknown[]; pageParams: unknown[] }

/**
 * Drop all but the head page of an infinite cache entry. An invalidated infinite
 * query refetches every cached page sequentially, so a deep scroll session would
 * replay N requests for one new post; one head page is enough — deeper pages
 * re-load on demand.
 */
function trimToHeadPage<T extends InfiniteShape>(data: T | undefined): T | undefined {
  if (!data || data.pages.length <= 1) return data
  return { ...data, pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }
}

/** Copy the thread root from the parent: root is parent.record.reply.root, else parent itself. */
function resolveReply(parent: AppBskyFeedDefs.PostView): {
  root: StrongRef
  parent: StrongRef
} {
  const parentRef: StrongRef = { uri: parent.uri, cid: parent.cid }
  // isRecord narrows to a $TypedObject; cast to the Record alias to read fields
  // (mirrors PostCard's handling of the unknown post.record).
  const rec = AppBskyFeedPost.isRecord(parent.record)
    ? (parent.record as AppBskyFeedPost.Record)
    : null
  if (rec?.reply?.root) {
    return { root: { uri: rec.reply.root.uri, cid: rec.reply.root.cid }, parent: parentRef }
  }
  return { root: parentRef, parent: parentRef }
}

/**
 * Create a post: facet detection -> blob upload -> createRecord.
 *
 * Embed precedence (embeds are mutually exclusive on a post):
 *   images present            -> app.bsky.embed.images
 *   quote present, no images  -> app.bsky.embed.record
 *   both                      -> app.bsky.embed.recordWithMedia
 *
 * After a successful write we invalidate the Following timeline and the
 * author's feed so the new post appears; we deliberately do NOT touch the
 * custom-feed caches (a reply/quote may not belong to them, and a refetch would
 * jitter the active tab).
 */
export function useCreatePost() {
  const { agent, did, handle } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ text: rawText, images, target }: CreatePostArgs) => {
      // Rewrite our-site links -> bsky.app and detect facets over the result;
      // the stored record uses `text` (not rawText) so offsets stay aligned.
      const { text, facets } = await buildPost(agent, rawText)

      // Upload images (compressed <1MB by lib/blob) and build the images embed.
      let imagesEmbed:
        | { $type: 'app.bsky.embed.images'; images: { image: BlobRef; alt: string }[] }
        | undefined
      if (images.length > 0) {
        const uploaded = await Promise.all(
          images.map(async (img) => ({
            image: await uploadImage(agent, img.file),
            alt: img.alt,
          })),
        )
        imagesEmbed = { $type: 'app.bsky.embed.images', images: uploaded }
      }

      const quoteRef = target.quote
        ? { uri: target.quote.uri, cid: target.quote.cid }
        : undefined

      let embed: Record<string, unknown> | undefined
      if (imagesEmbed && quoteRef) {
        embed = {
          $type: 'app.bsky.embed.recordWithMedia',
          record: { $type: 'app.bsky.embed.record', record: quoteRef },
          media: imagesEmbed,
        }
      } else if (imagesEmbed) {
        embed = imagesEmbed
      } else if (quoteRef) {
        embed = { $type: 'app.bsky.embed.record', record: quoteRef }
      }

      const reply = target.replyTo ? resolveReply(target.replyTo) : undefined

      const record: Partial<AppBskyFeedPost.Record> & { $type: string } = {
        $type: 'app.bsky.feed.post',
        text,
        facets,
        createdAt: new Date().toISOString(),
        langs: ['en'],
        ...(reply ? { reply } : {}),
        ...(embed ? { embed: embed as AppBskyFeedPost.Record['embed'] } : {}),
      }

      const res = await agent.com.atproto.repo.createRecord({
        repo: agent.assertDid,
        collection: 'app.bsky.feed.post',
        record,
      })
      return res.data
    },
    onSuccess: (_data, { target }) => {
      // Trim the timeline before invalidating, but only when nobody is looking
      // at it — an active observer keeps its pages (background refetch preserves
      // the scroll position); an inactive cache would refetch every page on next
      // mount for no benefit.
      const timeline = qc.getQueryCache().find({ queryKey: qk.timeline(did) })
      if (timeline && timeline.getObserversCount() === 0) {
        qc.setQueryData<InfiniteShape>(qk.timeline(did), trimToHeadPage)
      }
      void qc.invalidateQueries({ queryKey: qk.timeline(did) })

      // The author-feed tabs are keyed { actor, filter } per tab, and the actor
      // may be cached under handle or DID — sweep all variants through the
      // filterless prefix (qk.authorFeed with filter undefined matches nothing).
      for (const actor of [handle, did]) {
        if (actor) void qc.invalidateQueries({ queryKey: qk.authorFeedAll(did, actor) })
      }

      if (target.replyTo) {
        // Same reconciliation as use-reply: bump the parent's count wherever it
        // is cached and refetch the thread tree it belongs to.
        patchPostInAllFeeds(qc, did, target.replyTo.uri, bumpReplyCount)
        void qc.invalidateQueries({ queryKey: qk.threads })
      }
    },
  })
}
