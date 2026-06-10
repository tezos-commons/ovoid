import { useQuery } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * getUnreadCount, polled. Drives the bell badge. Separate from the list query
 * so the badge can refresh on a short interval without re-paginating the feed.
 *
 * Invariant: this count is the server's notion of "unseen" (everything after
 * the last updateSeen timestamp). updateSeen drives it to 0; we then
 * invalidate this key so the badge clears immediately rather than on the next
 * poll tick.
 */
export function useUnreadCount(pollMs = 30_000) {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    queryKey: qk.unreadCount(did),
    enabled: isAuthed,
    queryFn: () =>
      agent.app.bsky.notification
        .getUnreadCount()
        .then((r) => r.data.count),
    refetchInterval: pollMs,
    // Match the poll: refetchInterval already guarantees pollMs freshness, so a
    // shorter staleTime only buys redundant refetches on remount between ticks.
    staleTime: pollMs,
  })
}
