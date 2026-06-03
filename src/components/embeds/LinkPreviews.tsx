import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  type AppBskyFeedDefs,
  type AppBskyFeedPost,
} from '@atproto/api'
import { matchExternal, type ExternalEmbedMatcher } from './external-registry'

const LINK_FACET = 'app.bsky.richtext.facet#link'

/** Pull the link URLs out of a post record's rich-text facets. */
function facetLinkUris(facets?: AppBskyFeedPost.Record['facets']): string[] {
  if (!facets) return []
  const uris: string[] = []
  for (const facet of facets) {
    for (const feature of facet.features ?? []) {
      if ((feature as { $type?: string }).$type === LINK_FACET) {
        const uri = (feature as { uri?: string }).uri
        if (uri) uris.push(uri)
      }
    }
  }
  return uris
}

/** The URL already shown as an external-link embed, if any (so we don't double it). */
function externalEmbedUri(embed: AppBskyFeedDefs.PostView['embed']): string | undefined {
  return embed && AppBskyEmbedExternal.isView(embed) ? embed.external.uri : undefined
}

const PROVIDER_HOSTS = /(^|\.)(objkt\.com|teia\.art)$/

function isProviderHost(uri: string): boolean {
  try {
    return PROVIDER_HOSTS.test(new URL(uri).hostname)
  } catch {
    return false
  }
}

/** Provider-matched links in the post text, deduped and minus the external embed. */
function collectProviderLinks(
  record: AppBskyFeedPost.Record | null,
  embed: AppBskyFeedDefs.PostView['embed'],
): { uri: string; matcher: ExternalEmbedMatcher }[] {
  const skip = externalEmbedUri(embed)
  const seen = new Set<string>()
  const out: { uri: string; matcher: ExternalEmbedMatcher }[] = []
  for (const uri of facetLinkUris(record?.facets)) {
    if (uri === skip || seen.has(uri)) continue
    const matcher = matchExternal(uri)
    if (!matcher) continue
    seen.add(uri)
    out.push({ uri, matcher })
  }
  return out
}

/**
 * When a post links a provider URL (objkt/teia) AND carries a plain image
 * embed, the provider preview already renders the artwork (with its hover
 * detail overlay), so the standalone image embed is a duplicate. This reports
 * that case so PostCard can drop the image embed in favour of the rich preview.
 */
export function suppressImageEmbed(
  record: AppBskyFeedPost.Record | null,
  embed: AppBskyFeedDefs.PostView['embed'],
): boolean {
  return !!embed && AppBskyEmbedImages.isView(embed) && collectProviderLinks(record, embed).length > 0
}

/**
 * Every link URL that is being shown as a provider preview for this post — the
 * matched in-text facet links plus a matched external embed. PostCard passes
 * these to RichText so the raw URL is stripped from the body (the card stands
 * in for it).
 */
export function previewedLinkUris(
  record: AppBskyFeedPost.Record | null,
  embed: AppBskyFeedDefs.PostView['embed'],
): string[] {
  const uris = collectProviderLinks(record, embed).map((x) => x.uri)
  const ext = externalEmbedUri(embed)
  if (ext && matchExternal(ext)) uris.push(ext)
  return uris
}

/**
 * Drop the external-link card when it's a regular (non-token) objkt/teia card
 * and the post already shows token preview(s) elsewhere — avoids a redundant
 * plain marketplace card sitting next to the rich token previews.
 */
export function shouldDropExternalCard(
  record: AppBskyFeedPost.Record | null,
  embed: AppBskyFeedDefs.PostView['embed'],
): boolean {
  if (!embed || !AppBskyEmbedExternal.isView(embed)) return false
  const uri = embed.external.uri
  if (matchExternal(uri)) return false // it renders as a token preview itself
  if (!isProviderHost(uri)) return false // not a marketplace host
  return collectProviderLinks(record, embed).length > 0 // token previews present
}

/**
 * Renders source-specific previews (objkt, teia, …) for links that appear in a
 * post's *text* rather than as an external-link embed — e.g. an artwork posted
 * as an image with the marketplace link written in the body.
 */
export function ProviderLinkPreviews({
  record,
  embed,
}: {
  record: AppBskyFeedPost.Record | null
  embed: AppBskyFeedDefs.PostView['embed']
}) {
  const items = collectProviderLinks(record, embed)
  if (items.length === 0) return null
  return (
    <>
      {items.map(({ uri, matcher }) => {
        const Provider = matcher.Component
        const external = { uri, title: '', description: '' } as AppBskyEmbedExternal.ViewExternal
        return <Provider key={uri} external={external} />
      })}
    </>
  )
}
