import clsx from 'clsx'
import { useNavigate, Link } from 'react-router-dom'
import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedPost,
  type AppBskyFeedDefs,
} from '@atproto/api'
import { Avatar } from './Avatar'
import { usePostActions } from './PostActionsContext'
import { Img } from './Img'
import { VideoPlayer } from './VideoPlayer'
import { GenericExternalCard } from './embeds/GenericExternalCard'
import { matchExternal } from './embeds/external-registry'
import { RichText } from '@/lib/rich-text'
import { useDragScroll } from '@/lib/use-drag-scroll'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { threadOptions, buildPostUri } from '@/features/thread/use-thread'
import { profileOptions } from '@/features/profile/use-profile'
import { useUiStore } from '@/store/ui-store'

type Embed = AppBskyFeedDefs.PostView['embed']
type MediaView =
  | AppBskyEmbedImages.View
  | AppBskyEmbedExternal.View
  | AppBskyEmbedVideo.View
  | { $type: string }

/** A single displayable image, normalized across the images/gallery embeds. */
interface EmbedImage {
  thumb: string
  fullsize: string
  alt: string
  aspectRatio?: { width: number; height: number }
}

/**
 * `app.bsky.embed.gallery` is the newer multi-image embed (it supersedes
 * `images` and lifts the 4-image cap). @atproto/api 0.20.7 ships no types for
 * it, so we match by `$type` and normalize its items — note the field renames
 * (`items`/`thumbnail` vs `images`/`thumb`) — into the same EmbedImage shape
 * the images grid already renders.
 */
interface GalleryView {
  $type: string
  items: Array<{
    thumbnail: string
    fullsize: string
    alt?: string
    aspectRatio?: { width: number; height: number }
  }>
}
function isGalleryView(media: { $type?: string }): media is GalleryView {
  return (
    media.$type === 'app.bsky.embed.gallery#view' && Array.isArray((media as GalleryView).items)
  )
}

/**
 * Renders the `embed` view attached to a post. Handles the four AppView embed
 * view types plus recordWithMedia. `depth` bounds quote nesting so a quote of a
 * quote does not recurse arbitrarily — nested quotes render their text + media
 * but not a further embedded record.
 */
export function PostEmbed({ embed, depth = 0 }: { embed: Embed; depth?: number }) {
  if (!embed) return null

  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    return (
      <>
        <MediaEmbed media={embed.media} />
        <RecordEmbed record={embed.record.record} depth={depth} />
      </>
    )
  }
  if (AppBskyEmbedRecord.isView(embed)) {
    return <RecordEmbed record={embed.record} depth={depth} />
  }
  return <MediaEmbed media={embed as MediaView} />
}

/* ------------------------------------------------------- media (images/ext/video) */

function MediaEmbed({ media }: { media: MediaView }) {
  if (AppBskyEmbedExternal.isView(media)) return <ExternalEmbed external={media.external} />
  if (AppBskyEmbedImages.isView(media)) return <ImagesEmbed images={media.images} />
  if (AppBskyEmbedVideo.isView(media)) return <VideoPlayer video={media} />
  if (isGalleryView(media)) {
    const images: EmbedImage[] = media.items.map((it) => ({
      thumb: it.thumbnail,
      fullsize: it.fullsize,
      alt: it.alt ?? '',
      aspectRatio: it.aspectRatio,
    }))
    return <GalleryEmbed images={images} />
  }
  return null
}

/**
 * External link: render a source-specific preview if a provider matches the URL
 * (see embeds/external-registry), otherwise the generic link card.
 */
function ExternalEmbed({ external }: { external: AppBskyEmbedExternal.ViewExternal }) {
  const provider = matchExternal(external.uri)
  if (provider) {
    const Provider = provider.Component
    return <Provider external={external} />
  }
  return <GenericExternalCard external={external} />
}

function ImagesEmbed({ images }: { images: EmbedImage[] }) {
  const openLightbox = useUiStore((s) => s.openLightbox)
  const n = Math.min(images.length, 4)
  const single = images.length === 1
  const ar = single ? images[0].aspectRatio : undefined

  const open = (index: number) =>
    openLightbox({ images: images.map((im) => ({ src: im.fullsize, alt: im.alt })), index })

  return (
    <div
      className={clsx('embed', 'embed--images', `embed--images-${n}`)}
      onClick={(e) => e.stopPropagation()}
    >
      {images.map((img, i) => (
        <button
          key={i}
          type="button"
          className="embed-img"
          aria-label={img.alt || 'View image'}
          onClick={(e) => {
            e.stopPropagation()
            open(i)
          }}
          style={single && ar ? { aspectRatio: `${ar.width} / ${ar.height}` } : undefined}
        >
          <Img src={img.thumb} alt={img.alt} />
        </button>
      ))}
    </div>
  )
}

/**
 * Gallery embed: a single-row horizontal carousel, one picture tall, the strip
 * clipped at both edges and scrolled sideways — by the wheel (mapped onto the
 * horizontal axis) or by click-and-drag, both via useDragScroll. No scroll-snap,
 * so motion stays fluid. Each item keeps its own aspect ratio at a uniform
 * height, so widths vary like a filmstrip; a drag is suppressed from becoming a
 * click, so dragging the strip never opens the lightbox. Clicking does.
 */
function GalleryEmbed({ images }: { images: EmbedImage[] }) {
  const openLightbox = useUiStore((s) => s.openLightbox)
  const scroller = useDragScroll<HTMLDivElement>({ wheel: true })

  const open = (index: number) =>
    openLightbox({ images: images.map((im) => ({ src: im.fullsize, alt: im.alt })), index })

  return (
    <div ref={scroller} className="embed embed--gallery" onClick={(e) => e.stopPropagation()}>
      {images.map((img, i) => {
        const ar = img.aspectRatio
        return (
          <button
            key={i}
            type="button"
            className="gallery-img"
            aria-label={img.alt || 'View image'}
            onClick={(e) => {
              e.stopPropagation()
              open(i)
            }}
            // Reserve each cell's width pre-load (height is fixed in CSS) so the
            // strip doesn't reflow as images decode.
            style={ar ? { aspectRatio: `${ar.width} / ${ar.height}` } : undefined}
          >
            {/* draggable=false: otherwise pressing an image starts the browser's
                native image drag, which hijacks the click-drag scroll. */}
            <Img src={img.thumb} alt={img.alt} draggable={false} />
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ record (quote) */

type RecordUnion = AppBskyEmbedRecord.View['record']

function RecordEmbed({ record, depth }: { record: RecordUnion; depth: number }) {
  if (AppBskyEmbedRecord.isViewRecord(record)) {
    return <QuotePost record={record} depth={depth} />
  }
  if (AppBskyEmbedRecord.isViewNotFound(record)) {
    return <div className="embed embed--quote embed--quote-missing">Post not found</div>
  }
  if (AppBskyEmbedRecord.isViewBlocked(record)) {
    return <div className="embed embed--quote embed--quote-missing">Blocked post</div>
  }
  if (record.$type === 'app.bsky.embed.record#viewDetached') {
    return <div className="embed embed--quote embed--quote-missing">Removed by author</div>
  }
  // Quoted feed generator / list — show a light label card.
  const name = (record as { displayName?: string; name?: string }).displayName
    ?? (record as { name?: string }).name
  if (name) {
    return <div className="embed embed--quote">{name}</div>
  }
  return null
}

function QuotePost({
  record,
  depth,
}: {
  record: AppBskyEmbedRecord.ViewRecord
  depth: number
}) {
  const navigate = useNavigate()
  const actions = usePostActions()
  const a = record.author
  const val = AppBskyFeedPost.isRecord(record.value)
    ? (record.value as AppBskyFeedPost.Record)
    : null
  const rkey = record.uri.split('/').pop() ?? ''
  const permalink = `/profile/${a.handle || a.did}/post/${rkey}`
  const openThread = () =>
    actions ? actions.openThread(a.handle || a.did, rkey) : navigate(permalink)
  // Bound nesting: a top-level quote shows its own media; deeper quotes don't.
  const nested = depth < 1 ? record.embeds?.[0] : undefined

  // Same warming as PostCard: the quote navigates to its thread, the avatar to
  // the quoted author's profile. The thread uri must mirror the permalink's
  // actor (handle-first) — that's the key ThreadScreen will read.
  const { agent } = useAgent()
  const prefetchRef = usePrefetchOnVisible<HTMLDivElement>(() => {
    const thread = threadOptions(agent, buildPostUri(a.handle || a.did, rkey))
    schedulePrefetch(thread.queryKey, () => queryClient.prefetchQuery(thread))
    const profile = profileOptions(agent, a.handle || a.did)
    schedulePrefetch(profile.queryKey, () => queryClient.prefetchQuery(profile))
  })

  return (
    <div
      ref={prefetchRef}
      className="embed embed--quote"
      role="link"
      onClick={(e) => {
        e.stopPropagation()
        openThread()
      }}
    >
      <div className="embed-quote__head">
        <Link
          to={`/profile/${a.handle || a.did}`}
          onClick={(e) => e.stopPropagation()}
          className="embed-quote__avatar"
        >
          <Avatar src={a.avatar} alt={a.displayName || a.handle} size="xs" />
        </Link>
        <span className="embed-quote__name">{a.displayName || a.handle}</span>
        <span className="embed-quote__handle">@{a.handle}</span>
      </div>
      {val && (
        <div className="embed-quote__text">
          <RichText text={val.text} facets={val.facets} />
        </div>
      )}
      {nested && <PostEmbed embed={nested as Embed} depth={depth + 1} />}
    </div>
  )
}
