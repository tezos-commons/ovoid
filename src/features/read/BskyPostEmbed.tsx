import { useQuery } from '@tanstack/react-query'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { PostEmbed } from '@/components'

type EmbedProp = Parameters<typeof PostEmbed>[0]['embed']

/** PostView → app.bsky.embed.record#view, so we can reuse the app quote card. */
function asRecordView(post: AppBskyFeedDefs.PostView): EmbedProp {
  return {
    $type: 'app.bsky.embed.record#view',
    record: {
      $type: 'app.bsky.embed.record#viewRecord',
      uri: post.uri,
      cid: post.cid,
      author: post.author,
      value: post.record,
      labels: post.labels,
      embeds: post.embed ? [post.embed] : undefined,
      indexedAt: post.indexedAt,
    },
  } as EmbedProp
}

/**
 * Render an embedded Bluesky post (from a `bluesky-embed` blockquote in long-form
 * content) as the same quote card the timeline uses — internal profile/thread
 * links, facets, media. getPosts is public, so this works signed out too.
 */
export function BskyPostEmbed({ uri }: { uri: string }) {
  const { agent, did } = useAgent()
  const { data } = useQuery({
    queryKey: qk.embedPosts(did, [uri]),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await agent.app.bsky.feed.getPosts({ uris: [uri] })
      return res.data.posts[0] ?? null
    },
  })

  if (!data) return null
  return (
    <div className="rdr-bsky-embed">
      <PostEmbed embed={asRecordView(data)} />
    </div>
  )
}
