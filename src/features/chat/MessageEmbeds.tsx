import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AppBskyEmbedRecord,
  type $Typed,
  type AppBskyEmbedExternal,
  type ChatBskyConvoDefs,
} from '@atproto/api'
import { PostEmbed } from '@/components'
import { GenericExternalCard } from '@/components/embeds/GenericExternalCard'
import { matchExternal, type ExternalEmbedMatcher } from '@/components/embeds/external-registry'
import { useLinkMeta } from '@/components/embeds/use-link-meta'
import { extractTextUrls, postLinkParams, isAppLink } from '@/lib/bsky-links'
import { useAgent } from '@/lib/api/agent'
import {
  threadOptions,
  buildPostUri,
  isThreadViewPost,
  isBlockedPost,
} from '@/features/thread/use-thread'

const LINK_FACET = 'app.bsky.richtext.facet#link'

/** Cap rich previews per message so a link dump doesn't become a wall of cards. */
const MAX_EMBEDS = 3

/**
 * Link URLs carried by a chat message: facet links when present, else a raw
 * scan of the text (messages sent before this client attached facets, or by
 * clients that never do). Deduped, first-N.
 */
function messageLinkUris(message: ChatBskyConvoDefs.MessageView): string[] {
  const uris: string[] = []
  for (const facet of message.facets ?? []) {
    for (const feature of facet.features ?? []) {
      const f = feature as { $type?: string; uri?: string }
      if (f.$type === LINK_FACET && f.uri) uris.push(f.uri)
    }
  }
  if (uris.length === 0 && message.text) uris.push(...extractTextUrls(message.text))
  return [...new Set(uris)].slice(0, MAX_EMBEDS)
}

interface PostLink {
  uri: string
  actor: string
  rkey: string
}
interface ProviderLink {
  uri: string
  matcher: ExternalEmbedMatcher
}
interface MessageLinks {
  posts: PostLink[]
  providers: ProviderLink[]
  generic?: string
}

/** Classify a message's links into the preview kinds MessageEmbeds renders. */
function classifyMessageLinks(message: ChatBskyConvoDefs.MessageView): MessageLinks {
  const posts: PostLink[] = []
  const providers: ProviderLink[] = []
  let generic: string | undefined
  for (const uri of messageLinkUris(message)) {
    const post = postLinkParams(uri)
    if (post) {
      posts.push({ uri, ...post })
      continue
    }
    const matcher = matchExternal(uri)
    if (matcher) {
      providers.push({ uri, matcher })
      continue
    }
    // First non-app external link only — app links (profiles, group invites)
    // are in-app navigation, not link-card material.
    if (!generic && !isAppLink(uri)) generic = uri
  }
  return { posts, providers, generic }
}

/**
 * Link uris whose preview card ALWAYS renders (post links and provider links —
 * not the generic candidate, whose card depends on what the unfurler returns).
 * The bubble strips these from its text: the card stands in for the link.
 */
export function messagePreviewedLinkUris(message: ChatBskyConvoDefs.MessageView): string[] {
  const { posts, providers } = classifyMessageLinks(message)
  return [...posts.map((p) => p.uri), ...providers.map((p) => p.uri)]
}

/**
 * Rich previews under a chat bubble, mirroring how posts render embeds:
 *
 * - a record embed attached to the message (share-a-post from other clients)
 *   renders through the same PostEmbed pipeline as a quote post;
 * - post permalinks in the text (bsky.app or this app) hydrate via the THREAD
 *   query — the same qk.thread key ThreadScreen reads, so showing the card
 *   doubles as warming its navigation target;
 * - token links (objkt/teia) get their provider preview;
 * - the first remaining external link gets a generic OG card via cardyb,
 *   which is what a standard.site link resolves to outside the AppView.
 *
 * Returns null when the message carries none of the above, so the bubble
 * layout is untouched for plain messages.
 */
export function MessageEmbeds({ message }: { message: ChatBskyConvoDefs.MessageView }) {
  const recordEmbed =
    message.embed && AppBskyEmbedRecord.isView(message.embed) ? message.embed : null

  const { posts, providers, generic } = useMemo(() => classifyMessageLinks(message), [message])

  // Single hook for the one generic candidate keeps hook order stable across
  // renders regardless of how many links the message carries.
  const meta = useLinkMeta(generic)

  if (!recordEmbed && posts.length === 0 && providers.length === 0 && !meta.data) {
    return null
  }

  return (
    <div className="msg-embeds">
      {recordEmbed && <PostEmbed embed={recordEmbed} />}
      {posts.map((p) => (
        <MessagePostCard key={p.uri} actor={p.actor} rkey={p.rkey} />
      ))}
      {providers.map(({ uri, matcher }) => {
        const Provider = matcher.Component
        const external = { uri, title: '', description: '' } as AppBskyEmbedExternal.ViewExternal
        return <Provider key={uri} external={external} />
      })}
      {generic && meta.data && (
        <GenericExternalCard
          external={
            {
              uri: generic,
              title: meta.data.title,
              description: meta.data.description,
              thumb: meta.data.image,
            } as AppBskyEmbedExternal.ViewExternal
          }
        />
      )}
    </div>
  )
}

/**
 * Quote-style card for a post permalink in a message. Hydrates from the thread
 * query keyed by the route-built uri (actor as the permalink carried it), so
 * the data shown here IS the destination's cache entry — tapping through to
 * the thread renders instantly. The PostView is reshaped into a viewRecord so
 * PostEmbed's quote renderer (with its own visibility prefetch of thread +
 * author profile) does the rest.
 */
function MessagePostCard({ actor, rkey }: { actor: string; rkey: string }) {
  const { agent } = useAgent()
  const thread = useQuery(threadOptions(agent, buildPostUri(actor, rkey)))
  const node = thread.data?.thread

  if (!node) return null
  if (isBlockedPost(node)) {
    return <div className="embed embed--quote embed--quote-missing">Blocked post</div>
  }
  if (!isThreadViewPost(node)) {
    return <div className="embed embed--quote embed--quote-missing">Post not found</div>
  }

  const post = node.post
  const view: $Typed<AppBskyEmbedRecord.View> = {
    $type: 'app.bsky.embed.record#view',
    record: {
      $type: 'app.bsky.embed.record#viewRecord',
      uri: post.uri,
      cid: post.cid,
      author: post.author,
      value: post.record,
      indexedAt: post.indexedAt,
      // PostView.embed and viewRecord.embeds[] are the same view union, but the
      // former's members aren't $Typed-branded — assert across the brand.
      embeds: post.embed
        ? ([post.embed] as AppBskyEmbedRecord.ViewRecord['embeds'])
        : undefined,
    },
  }
  return <PostEmbed embed={view} />
}
