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
import { VideoPlayer } from './VideoPlayer'
import { GenericExternalCard } from './embeds/GenericExternalCard'
import { matchExternal } from './embeds/external-registry'
import { RichText } from '@/lib/rich-text'
import { useUiStore } from '@/store/ui-store'

type Embed = AppBskyFeedDefs.PostView['embed']
type MediaView =
  | AppBskyEmbedImages.View
  | AppBskyEmbedExternal.View
  | AppBskyEmbedVideo.View
  | { $type: string }

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

function ImagesEmbed({ images }: { images: AppBskyEmbedImages.ViewImage[] }) {
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
          <img src={img.thumb} alt={img.alt} loading="lazy" />
        </button>
      ))}
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
  const a = record.author
  const val = AppBskyFeedPost.isRecord(record.value)
    ? (record.value as AppBskyFeedPost.Record)
    : null
  const rkey = record.uri.split('/').pop() ?? ''
  const permalink = `/profile/${a.handle || a.did}/post/${rkey}`
  // Bound nesting: a top-level quote shows its own media; deeper quotes don't.
  const nested = depth < 1 ? record.embeds?.[0] : undefined

  return (
    <div
      className="embed embed--quote"
      role="link"
      onClick={(e) => {
        e.stopPropagation()
        navigate(permalink)
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
