import { Fragment, useMemo, type ReactNode } from 'react'
import { Agent, RichText as AtpRichText, type AppBskyFeedPost } from '@atproto/api'
import { Link } from 'react-router-dom'
import { MentionChip } from '@/components/MentionChip'
import { profileOptions } from '@/features/profile/use-profile'
import { bskyUrlToInternalPath, rewriteSelfLinksToBsky } from './bsky-links'
import { useAgent } from './api/agent'
import { queryClient } from './query-client'
import { schedulePrefetch } from './prefetch'
import { usePrefetchOnVisible } from './use-prefetch-on-visible'

export interface RichTextProps {
  text: string
  facets?: AppBskyFeedPost.Record['facets']
  className?: string
  /** Link URLs to drop from the rendered text (e.g. a link shown as a preview
   *  card). Trailing whitespace left by a removed trailing link is trimmed. */
  omitLinkUris?: string[]
  /** Render @-mentions as inline profile chips (avatar + name) instead of a
   *  plain text link. Used in bios and chat messages. */
  mentionChips?: boolean
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
export function RichText({ text, facets, className, omitLinkUris, mentionChips }: RichTextProps) {
  // The facet walk (UTF-8 byteSlice over every segment) is the expensive part;
  // memoize it on the record's identity. `facets` comes from the query cache,
  // where structural sharing keeps it referentially stable across re-renders.
  // The omitLinkUris filter below stays outside — it's trivial, and its array
  // is rebuilt per parent render so it can't key a memo.
  const segs = useMemo(() => {
    const rt = new AtpRichText({ text, facets: facets ?? undefined })
    const out: Seg[] = []
    for (const s of rt.segments()) {
      if (s.isLink() && s.link) out.push({ text: s.text, link: s.link.uri })
      else if (s.isMention() && s.mention) out.push({ text: s.text, mentionDid: s.mention.did })
      else if (s.isTag() && s.tag) out.push({ text: s.text, tag: s.tag.tag })
      else out.push({ text: s.text })
    }
    return out
  }, [text, facets])

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

  return <span className={className}>{renderSegs(kept, mentionChips)}</span>
}

function renderSegs(segs: Seg[], mentionChips?: boolean): ReactNode[] {
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
        mentionChips ? (
          <MentionChip key={k} actor={segment.mentionDid} text={segment.text} />
        ) : (
          <MentionLink key={k} did={segment.mentionDid} text={segment.text} />
        ),
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
 * @-mention link with the standard link-surface warm: prefetch the profile
 * once the mention dwells in view (same rule as PostCard's author link).
 */
function MentionLink({ did, text }: { did: string; text: string }) {
  const { agent } = useAgent()
  const ref = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const profile = profileOptions(agent, did)
    schedulePrefetch(profile.queryKey, () => queryClient.prefetchQuery(profile))
  })
  return (
    <Link ref={ref} to={`/profile/${did}`} className="rt-link">
      {text}
    </Link>
  )
}

/**
 * Render a profile bio (or any facet-less text): detect links / @mentions / #tags
 * locally — synchronously, no handle→DID resolution — then render them clickable.
 * Mentions resolve to /profile/<handle> (the route accepts a handle), and render
 * as inline profile chips. Bios carry no facets in the profile view, so detection
 * is what makes them interactive.
 */
export function BioText({ text, className }: { text: string; className?: string }) {
  const facets = useMemo(() => {
    const rt = new AtpRichText({ text })
    rt.detectFacetsWithoutResolution()
    return rt.facets
  }, [text])
  return <RichText text={text} facets={facets} className={className} mentionChips />
}

/**
 * The text that remains once the given link uris are removed — facet-aware
 * (drops whole link segments, byte-safe via RichText.segments) with a plain
 * substring fallback for facet-less text, where extracted raw URLs appear
 * verbatim. Used to decide whether a chat bubble still has content after its
 * previewed links are stripped.
 */
export function textWithoutLinkUris(
  text: string,
  facets: AppBskyFeedPost.Record['facets'],
  omit: string[],
): string {
  if (omit.length === 0) return text.trim()
  if (!facets?.length) {
    let out = text
    for (const uri of omit) out = out.split(uri).join('')
    return out.trim()
  }
  const omitSet = new Set(omit)
  const rt = new AtpRichText({ text, facets })
  let out = ''
  for (const s of rt.segments()) {
    if (s.isLink() && s.link && omitSet.has(s.link.uri)) continue
    out += s.text
  }
  return out.trim()
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
