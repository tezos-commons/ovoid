import { Fragment, type ReactNode } from 'react'
import { Agent, RichText as AtpRichText, type AppBskyFeedPost } from '@atproto/api'
import { Link } from 'react-router-dom'
import { bskyUrlToInternalPath, rewriteSelfLinksToBsky } from './bsky-links'

export interface RichTextProps {
  text: string
  facets?: AppBskyFeedPost.Record['facets']
  className?: string
  /** Link URLs to drop from the rendered text (e.g. a link shown as a preview
   *  card). Trailing whitespace left by a removed trailing link is trimmed. */
  omitLinkUris?: string[]
}

interface Seg {
  text: string
  link?: string
  mentionDid?: string
  tag?: string
}

/**
 * Facet-aware text renderer. Iterates RichText.segments() so we never slice
 * raw text by byte offsets ourselves — the atproto helper handles UTF-8
 * byteSlice boundaries and grapheme safety.
 *
 * Links / tags render as plain anchors; mentions route to /profile/:did.
 */
export function RichText({ text, facets, className, omitLinkUris }: RichTextProps) {
  const rt = new AtpRichText({ text, facets: facets ?? undefined })

  const segs: Seg[] = []
  for (const s of rt.segments()) {
    if (s.isLink() && s.link) segs.push({ text: s.text, link: s.link.uri })
    else if (s.isMention() && s.mention) segs.push({ text: s.text, mentionDid: s.mention.did })
    else if (s.isTag() && s.tag) segs.push({ text: s.text, tag: s.tag.tag })
    else segs.push({ text: s.text })
  }

  let kept = segs
  if (omitLinkUris && omitLinkUris.length) {
    const omit = new Set(omitLinkUris)
    kept = segs.filter((s) => !(s.link && omit.has(s.link)))
    // A removed trailing link leaves the preceding text's whitespace dangling.
    const last = kept[kept.length - 1]
    if (last && !last.link && !last.mentionDid && !last.tag) {
      const trimmed = last.text.replace(/\s+$/, '')
      kept = trimmed ? [...kept.slice(0, -1), { ...last, text: trimmed }] : kept.slice(0, -1)
    }
  }

  return <span className={className}>{renderSegs(kept)}</span>
}

function renderSegs(segs: Seg[]): ReactNode[] {
  const out: ReactNode[] = []
  let key = 0
  for (const segment of segs) {
    const k = key++
    if (segment.link) {
      // A bsky.app link to a route we mirror navigates in-app; everything else
      // stays an external anchor.
      const internal = bskyUrlToInternalPath(segment.link)
      out.push(
        internal ? (
          <Link key={k} to={internal} className="rt-link">
            {segment.text}
          </Link>
        ) : (
          <a
            key={k}
            href={segment.link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rt-link"
          >
            {segment.text}
          </a>
        ),
      )
    } else if (segment.mentionDid) {
      out.push(
        <Link key={k} to={`/profile/${segment.mentionDid}`} className="rt-link">
          {segment.text}
        </Link>,
      )
    } else if (segment.tag) {
      out.push(
        <Link
          key={k}
          to={`/search?q=${encodeURIComponent('#' + segment.tag)}`}
          className="rt-link"
        >
          {segment.text}
        </Link>,
      )
    } else {
      out.push(<Fragment key={k}>{segment.text}</Fragment>)
    }
  }
  return out
}

/**
 * Detect facets (mentions/links/tags) for outgoing posts. Resolves handles to
 * DIDs via the authed agent. Use before createRecord in the composer.
 */
export async function buildFacets(
  agent: Agent,
  text: string,
): Promise<AppBskyFeedPost.Record['facets']> {
  const rt = new AtpRichText({ text })
  await rt.detectFacets(agent)
  return rt.facets
}

/**
 * Prepare a post for writing: rewrite this-app links to their portable bsky.app
 * form, THEN detect facets over the rewritten text so the link facets point at
 * bsky.app too. Returns both — the caller must store the returned `text`, not
 * the raw input, or the facet byte offsets won't line up.
 */
export async function buildPost(
  agent: Agent,
  rawText: string,
): Promise<{ text: string; facets: AppBskyFeedPost.Record['facets'] }> {
  const text = rewriteSelfLinksToBsky(rawText)
  const facets = await buildFacets(agent, text)
  return { text, facets }
}
