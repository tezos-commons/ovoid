/**
 * Minimal types for `pub.leaflet.content` — the content variant standard.site
 * documents from Leaflet (and compatible platforms) carry. The union is open,
 * so every shape is best-effort: the renderer switches on `$type` and degrades
 * unknown blocks to their `plaintext` (or nothing).
 *
 * Verified against real records (e.g. pfrazee.com's site.standard.document).
 * Block byte ranges in facets are UTF-8 offsets, exactly like app.bsky facets.
 */

export interface BlobRef {
  $type: 'blob'
  ref: { $link: string }
  mimeType: string
  size: number
}

export interface FacetFeature {
  $type: string // pub.leaflet.richtext.facet#{link|bold|italic|code|…}
  uri?: string // #link
  did?: string // #didMention / #atMention
}

export interface Facet {
  index: { byteStart: number; byteEnd: number }
  features: FacetFeature[]
}

export interface RichText {
  plaintext: string
  facets?: Facet[]
}

export interface TextBlock extends RichText {
  $type: 'pub.leaflet.blocks.text'
}
export interface HeaderBlock extends RichText {
  $type: 'pub.leaflet.blocks.header'
  level: number
}
export interface BlockquoteBlock extends RichText {
  $type: 'pub.leaflet.blocks.blockquote'
}
export interface CodeBlock {
  $type: 'pub.leaflet.blocks.code'
  plaintext: string
  language?: string
}
export interface HorizontalRuleBlock {
  $type: 'pub.leaflet.blocks.horizontalRule'
}
export interface ImageBlock {
  $type: 'pub.leaflet.blocks.image'
  image: BlobRef
  aspectRatio?: { width: number; height: number }
  alt?: string
}
export interface ListItem {
  $type: string // pub.leaflet.blocks.{un}orderedList#listItem
  content: RichText & { $type: string }
  children?: ListItem[]
}
export interface ListBlock {
  $type: 'pub.leaflet.blocks.unorderedList' | 'pub.leaflet.blocks.orderedList'
  children: ListItem[]
}

export type Block =
  | TextBlock
  | HeaderBlock
  | BlockquoteBlock
  | CodeBlock
  | HorizontalRuleBlock
  | ImageBlock
  | ListBlock
  | { $type: string; plaintext?: string } // unknown — best-effort fallback

export interface LinearDocumentPage {
  $type: 'pub.leaflet.pages.linearDocument'
  id?: string
  blocks: { $type: string; block: Block }[]
}

export interface LeafletContent {
  $type: 'pub.leaflet.content'
  pages: LinearDocumentPage[]
}

export function isLeafletContent(content: unknown): content is LeafletContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as { $type?: string }).$type === 'pub.leaflet.content'
  )
}
