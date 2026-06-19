import { Fragment, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import GithubSlugger from 'github-slugger'
import { Img } from '@/components'
import { useUiStore } from '@/store/ui-store'
import { blobUrl } from '@/lib/api/repo-read'
import { bskyUrlToInternalPath } from '@/lib/bsky-links'
import { CodeBlock } from './CodeBlock'
import { ContentEmbeds } from './ContentEmbeds'
import {
  type Block,
  type FacetFeature,
  type LeafletContent,
  type ListItem,
  type RichText,
} from './leaflet'

const enc = new TextEncoder()
const dec = new TextDecoder()

/**
 * Render rich text by slicing the plaintext on facet **byte** ranges (UTF-8
 * offsets, like app.bsky facets — not JS string indices). Facets are assumed
 * non-overlapping; within a range every feature is applied by nesting.
 */
function renderRichText(rt: RichText, keyBase: string): ReactNode {
  const text = rt.plaintext ?? ''
  const facets = (rt.facets ?? []).filter((f) => f.index.byteEnd > f.index.byteStart)
  if (facets.length === 0) return text

  const bytes = enc.encode(text)
  const sorted = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart)
  const out: ReactNode[] = []
  let cursor = 0

  const slice = (start: number, end: number) => dec.decode(bytes.slice(start, end))

  sorted.forEach((facet, i) => {
    const { byteStart, byteEnd } = facet.index
    if (byteStart < cursor) return // overlap — skip rather than double-render
    if (byteStart > cursor) out.push(<Fragment key={`t${i}`}>{slice(cursor, byteStart)}</Fragment>)
    out.push(applyFeatures(slice(byteStart, byteEnd), facet.features, `${keyBase}-f${i}`))
    cursor = byteEnd
  })
  if (cursor < bytes.length) out.push(<Fragment key="tail">{slice(cursor, bytes.length)}</Fragment>)
  return out
}

/** Every link target carried by a rich-text block's facets, in order. */
function linkUris(rt: RichText): string[] {
  const out: string[] = []
  for (const f of rt.facets ?? []) {
    for (const feat of f.features) {
      if (feat.$type.endsWith('#link') && feat.uri) out.push(feat.uri)
    }
  }
  return out
}

function applyFeatures(text: string, features: FacetFeature[], key: string): ReactNode {
  // Order matters only for nesting; the visual result is the same either way.
  return features.reduce<ReactNode>((inner, feat) => {
    const t = feat.$type.split('#')[1]
    switch (t) {
      case 'link': {
        const internal = feat.uri ? bskyUrlToInternalPath(feat.uri) : null
        if (internal) {
          return (
            <Link key={key} to={internal}>
              {inner}
            </Link>
          )
        }
        return (
          <a key={key} href={feat.uri} target="_blank" rel="noopener noreferrer ugc">
            {inner}
          </a>
        )
      }
      case 'bold':
        return <strong key={key}>{inner}</strong>
      case 'italic':
        return <em key={key}>{inner}</em>
      case 'code':
        return <code key={key}>{inner}</code>
      case 'didMention':
      case 'atMention':
        return feat.did ? (
          <Link key={key} to={`/profile/${feat.did}`}>
            {inner}
          </Link>
        ) : (
          inner
        )
      default:
        return inner // underline/strikethrough/highlight/footnote/unknown → plain
    }
  }, text)
}

function ListItems({ items, ordered, k }: { items: ListItem[]; ordered: boolean; k: string }) {
  return (
    <>
      {items.map((it, i) => {
        const key = `${k}-${i}`
        return (
          <li key={key}>
            {renderRichText(it.content, key)}
            {it.children && it.children.length > 0 &&
              (ordered ? (
                <ol>
                  <ListItems items={it.children} ordered k={`${key}o`} />
                </ol>
              ) : (
                <ul>
                  <ListItems items={it.children} ordered={false} k={`${key}u`} />
                </ul>
              ))}
          </li>
        )
      })}
    </>
  )
}

/** Heading text + a hover anchor link to its id. */
function HeadingAnchor({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <>
      {children}
      {id && (
        <a className="rdr-heading-anchor" href={`#${id}`} aria-label="Link to this section">
          #
        </a>
      )}
    </>
  )
}

/** A Leaflet image — click to open the shared lightbox. */
function LeafletImage({
  src,
  alt,
  aspectRatio,
}: {
  src: string
  alt?: string
  aspectRatio?: { width: number; height: number }
}) {
  const openLightbox = useUiStore((s) => s.openLightbox)
  return (
    <figure className="rdr-figure">
      <Img
        src={src}
        alt={alt ?? ''}
        className="rdr-zoomable"
        style={aspectRatio ? { aspectRatio: `${aspectRatio.width} / ${aspectRatio.height}` } : undefined}
        onClick={() => openLightbox({ images: [{ src, alt }], index: 0 })}
      />
      {alt && <figcaption>{alt}</figcaption>}
    </figure>
  )
}

function BlockView({
  block,
  pds,
  did,
  k,
  headingId,
}: {
  block: Block
  pds: string
  did: string
  k: string
  headingId?: string
}) {
  switch (block.$type) {
    case 'pub.leaflet.blocks.text': {
      const rt = block as RichText
      if (!rt.plaintext) return <p className="rdr-spacer" aria-hidden="true" />
      return (
        <>
          <p>{renderRichText(rt, k)}</p>
          <ContentEmbeds urls={linkUris(rt)} />
        </>
      )
    }
    case 'pub.leaflet.blocks.header': {
      const h = block as RichText & { level: number }
      const Tag = (`h${Math.min((h.level || 1) + 1, 6)}`) as keyof JSX.IntrinsicElements
      return (
        <Tag id={headingId}>
          <HeadingAnchor id={headingId}>{renderRichText(h, k)}</HeadingAnchor>
        </Tag>
      )
    }
    case 'pub.leaflet.blocks.blockquote':
      return <blockquote>{renderRichText(block as RichText, k)}</blockquote>
    case 'pub.leaflet.blocks.code': {
      const c = block as { plaintext: string; language?: string }
      return <CodeBlock code={c.plaintext} language={c.language} />
    }
    case 'pub.leaflet.blocks.horizontalRule':
      return <hr className="rdr-hr" />
    case 'pub.leaflet.blocks.image': {
      const img = block as {
        image: { ref: { $link: string } }
        aspectRatio?: { width: number; height: number }
        alt?: string
      }
      return (
        <LeafletImage
          src={blobUrl(pds, did, img.image.ref.$link)}
          alt={img.alt}
          aspectRatio={img.aspectRatio}
        />
      )
    }
    case 'pub.leaflet.blocks.unorderedList':
      return (
        <ul>
          <ListItems items={(block as { children: ListItem[] }).children} ordered={false} k={k} />
        </ul>
      )
    case 'pub.leaflet.blocks.orderedList':
      return (
        <ol>
          <ListItems items={(block as { children: ListItem[] }).children} ordered k={k} />
        </ol>
      )
    default: {
      // Unknown block — render its plaintext if it has one, else drop it.
      const pt = (block as { plaintext?: string }).plaintext
      return pt ? <p>{pt}</p> : null
    }
  }
}

/** Render a `pub.leaflet.content` body — pages of linear blocks. */
export function LeafletContent({
  content,
  pds,
  did,
}: {
  content: LeafletContent
  pds: string
  did: string
}) {
  // Flatten to a render list, assigning stable heading ids (slugged in document
  // order so they match the DOM the ToC reads).
  const items = useMemo(() => {
    const slugger = new GithubSlugger()
    return content.pages.flatMap((page, pi) =>
      (page.blocks ?? []).map((entry, bi) => {
        const block = entry.block
        const headingId =
          block.$type === 'pub.leaflet.blocks.header'
            ? slugger.slug((block as { plaintext?: string }).plaintext || 'section')
            : undefined
        return { key: `${pi}-${bi}`, block, headingId }
      }),
    )
  }, [content])

  return (
    <div className="rdr-body">
      {items.map((it) => (
        <BlockView
          key={it.key}
          block={it.block}
          pds={pds}
          did={did}
          k={it.key}
          headingId={it.headingId}
        />
      ))}
    </div>
  )
}
