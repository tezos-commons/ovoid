import { useQuery } from '@tanstack/react-query'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Batch-hydrate the posts a notification list references by bare AT-URI:
 *   - like/repost cluster subjects (notification.reasonSubject), and
 *   - reply/mention/quote notifications themselves — their list payload carries
 *     the raw record but no embed *view*, so images and quoted posts only render
 *     once we fetch the hydrated PostView here.
 * getPosts caps at 25 URIs/call, so we chunk. Result is a uri→PostView map.
 */
const CHUNK = 25

export function useSubjectPosts(uris: string[]) {
  const { agent, did, isAuthed } = useAgent()
  // Stable, order-independent key so reordering the visible set doesn't refetch.
  const sorted = [...uris].sort()
  return useQuery({
    queryKey: [...qk.notifications(did), 'subjects', sorted] as const,
    enabled: isAuthed && sorted.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const map: Record<string, AppBskyFeedDefs.PostView> = {}
      for (let i = 0; i < sorted.length; i += CHUNK) {
        const slice = sorted.slice(i, i + CHUNK)
        const res = await agent.app.bsky.feed.getPosts({ uris: slice })
        for (const p of res.data.posts) map[p.uri] = p
      }
      return map
    },
  })
}
