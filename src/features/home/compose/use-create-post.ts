import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AppBskyFeedPost,
  type AppBskyActorDefs,
  type AppBskyFeedDefs,
  type BlobRef,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { bumpReplyCount, insertReplyInThreads, patchPostInAllFeeds } from '@/lib/optimistic'
import { buildPost } from '@/lib/rich-text'
import { resolveEmbeddableLinks } from '@/features/read/embeddable-url'
import { uploadImage } from '@/lib/blob'
import type { ComposeTarget } from '@/store/compose-store'

export interface PendingImage {
  file: File
  /** Object URL for the preview thumbnail. */
  url: string
  alt: string
}

export interface DraftPost {
  text: string
  images: PendingImage[]
}

export interface CreateThreadArgs {
  posts: DraftPost[]
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
 * Thrown when a multi-post thread partially succeeds: posts [0, sentCount) were
 * created on the repo (and their cache work flushed) before post `sentCount`
 * failed. The caller must NOT retry the whole batch — that would duplicate the
 * sent posts — so it trims the sent drafts and leaves the remainder to retry.
 */
export class ThreadPartialError extends Error {
  readonly sentCount: number
  constructor(sentCount: number, cause: unknown) {
    super(`Thread stopped at post ${sentCount}`)
    this.name = 'ThreadPartialError'
    this.sentCount = sentCount
    // Preserve the underlying cause for the composer's error message.
    this.cause = cause instanceof Error ? cause : new Error(String(cause))
  }
}

interface BuildEmbedArgs {
  images: PendingImage[]
  quote: StrongRef | undefined
  agent: ReturnType<typeof useAgent>['agent']
}

/**
 * Build the optional embed for one post. Embeds are mutually exclusive on a
 * record; precedence matches Bluesky:
 *   images present            -> app.bsky.embed.images
 *   quote present, no images  -> app.bsky.embed.record
 *   both                      -> app.bsky.embed.recordWithMedia
 *   neither, but an article   -> app.bsky.embed.external
 */
async function buildEmbed({
  images,
  quote,
  agent,
}: BuildEmbedArgs): Promise<Record<string, unknown> | undefined> {
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

  if (imagesEmbed && quote) {
    return {
      $type: 'app.bsky.embed.recordWithMedia',
      record: { $type: 'app.bsky.embed.record', record: quote },
      media: imagesEmbed,
    }
  }
  if (imagesEmbed) return imagesEmbed
  if (quote) return { $type: 'app.bsky.embed.record', record: quote }
  return undefined
}

interface CreateOneArgs {
  text: string
  images: PendingImage[]
  quote: StrongRef | undefined
  reply: { root: StrongRef; parent: StrongRef } | undefined
  agent: ReturnType<typeof useAgent>['agent']
}

interface CreatedPost {
  uri: string
  cid: string
  record: Partial<AppBskyFeedPost.Record> & { $type: string }
  text: string
  facets: AppBskyFeedPost.Record['facets']
  createdAt: string
}

/**
 * Build the record for one post and createRecord it. Pure of cache concerns: it
 * returns the strong ref so the caller can thread it into the next post.
 */
async function createOne({ text: rawText, images, quote, reply, agent }: CreateOneArgs): Promise<CreatedPost> {
  // Reader links -> the article's canonical embeddable URL (so the standard.site
  // card renders on Bluesky), then our-site links -> bsky.app + facet detection;
  // the stored record uses `text` (not rawText) so offsets stay aligned.
  const { text: embeddable, articles } = await resolveEmbeddableLinks(rawText)
  const { text, facets } = await buildPost(agent, embeddable)

  let embed = await buildEmbed({ images, quote, agent })
  if (!embed && articles.length > 0) {
    // A standard.site article link with no other embed: attach the external
    // embed the card renders from. The AppView enriches it (publication,
    // author + Follow) server-side for every client.
    const a = articles[0]
    embed = {
      $type: 'app.bsky.embed.external',
      external: { uri: a.url, title: a.title, description: a.description ?? '' },
    }
  }

  const createdAt = new Date().toISOString()
  const record: Partial<AppBskyFeedPost.Record> & { $type: string } = {
    $type: 'app.bsky.feed.post',
    text,
    facets,
    createdAt,
    langs: ['en'],
    ...(reply ? { reply } : {}),
    ...(embed ? { embed: embed as AppBskyFeedPost.Record['embed'] } : {}),
  }

  const res = await agent.com.atproto.repo.createRecord({
    repo: agent.assertDid,
    collection: 'app.bsky.feed.post',
    record,
  })
  return { uri: res.data.uri, cid: res.data.cid, record, text, facets, createdAt }
}

/**
 * Create a thread of one-or-more posts. AT Protocol threads are reply chains —
 * each post references the previous post's uri/cid — so creation is necessarily
 * sequential: post N+1's `reply.parent` is post N's strong ref, and `reply.root`
 * is the original root (the replyTo ancestor if replying, else post 0).
 *
 * Post 0 honors the compose target: a replyTo attaches a reply + bumps the
 * parent; a quote embeds on post 0 only. Posts 1..n are plain continuation
 * replies threading off post 0's root.
 *
 * Partial failure: if post K fails after 0..K-1 succeeded, those K posts are
 * already on the repo. We flush their cache work, then throw ThreadPartialError
 * so the caller can trim the sent drafts and retry only the remainder — a naive
 * retry of the whole batch would duplicate the sent posts.
 */
export function useCreateThread() {
  const { agent, did, handle, avatar } = useAgent()
  const qc = useQueryClient()

  const viewerDisplayName = (): string | undefined => {
    for (const k of [qk.profile(did ?? ''), qk.profile(handle ?? '')]) {
      const p = qc.getQueryData<AppBskyActorDefs.ProfileViewDetailed>(k)
      if (p?.displayName) return p.displayName
    }
    return undefined
  }

  return useMutation({
    mutationFn: async ({ posts, target }: CreateThreadArgs) => {
      if (posts.length === 0) throw new Error('Nothing to post')

      // The quote embeds on post 0 only; later posts can't also quote.
      const quoteRef = target.quote
        ? { uri: target.quote.uri, cid: target.quote.cid }
        : undefined

      // The thread's root is fixed by the ancestor we're replying to (if any):
      // replying -> the ancestor's root; a standalone thread -> post 0 itself,
      // once created. `chain` advances post-to-post as the parent ref.
      const ancestorReply = target.replyTo ? resolveReply(target.replyTo) : undefined
      const root: StrongRef = ancestorReply?.root ?? { uri: '', cid: '' }

      const created: CreatedPost[] = []
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i]
        // post 0: reply to the ancestor (if any). post N>0: reply threading off
        // the previous post, sharing the thread root.
        let reply: { root: StrongRef; parent: StrongRef } | undefined
        if (i === 0) {
          reply = ancestorReply ?? undefined
        } else {
          const prev = created[i - 1]
          reply = { root, parent: { uri: prev.uri, cid: prev.cid } }
        }
        // A quote targets post 0 only.
        const quote = i === 0 ? quoteRef : undefined

        try {
          const res = await createOne({ ...post, quote, reply, agent })
          created.push(res)
          // First standalone post sets the thread root for its continuations.
          if (i === 0 && !ancestorReply) {
            root.uri = res.uri
            root.cid = res.cid
          }
        } catch (err) {
          if (created.length > 0) throw new ThreadPartialError(created.length, err)
          throw err
        }
      }

      // Synthesize post 0's PostView so a reply can be spliced into the open
      // thread immediately (the AppView hasn't indexed it yet). Text/facets only.
      const first = created[0]
      const replyPost: AppBskyFeedDefs.PostView | undefined = ancestorReply
        ? {
            $type: 'app.bsky.feed.defs#postView',
            uri: first.uri,
            cid: first.cid,
            author: {
              did: did ?? '',
              handle: handle ?? 'handle.invalid',
              displayName: viewerDisplayName(),
              avatar,
            },
            record: { ...first.record, text: first.text, facets: first.facets, createdAt: first.createdAt } as AppBskyFeedPost.Record,
            replyCount: 0,
            repostCount: 0,
            likeCount: 0,
            quoteCount: 0,
            indexedAt: first.createdAt,
            viewer: {},
          }
        : undefined

      return { sentCount: created.length, replyPost }
    },
    onSuccess: (data, { target }) => {
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
        // Bump the parent's reply count wherever cached, and splice the new
        // reply into the open thread so it shows immediately. We do NOT
        // invalidate the thread — the write isn't indexed yet, so a refetch
        // would drop it; the next natural thread fetch reconciles.
        patchPostInAllFeeds(qc, did, target.replyTo.uri, bumpReplyCount)
        if (data.replyPost) insertReplyInThreads(qc, target.replyTo.uri, data.replyPost)
      }
    },
  })
}
