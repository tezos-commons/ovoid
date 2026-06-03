import { useQuery } from '@tanstack/react-query'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Batch-hydrate the subject posts referenced by like/repost clusters
 * (notification.reasonSubject), which arrive as bare AT-URIs without a view.
 * getPosts caps at 25 URIs/call, so we chunk. Result is a uri→PostView map the
 * NotificationGroup uses to render the subject preview line.
 *
 * This is the ONLY N-hydration we do: feed-style notifications (reply/mention/
 * quote) already carry their record, so they need no extra fetch.
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
