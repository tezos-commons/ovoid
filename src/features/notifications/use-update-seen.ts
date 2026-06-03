import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * updateSeen({ seenAt }) marks everything up to `seenAt` as seen, clearing the
 * badge. It does NOT mutate per-item `isRead`, so the list's blue-tint
 * highlighting persists for this view (matching Bluesky: you still see what was
 * new even after the badge clears).
 *
 * Returns a stable callback the screen fires once on mount. We optimistically
 * zero the unread-count cache and then invalidate it; we never refetch the
 * notifications list (the seenAt timestamp isn't part of its key).
 */
export function useUpdateSeen() {
  const { agent, did, isAuthed } = useAgent()
  const qc = useQueryClient()

  return useCallback(async () => {
    if (!isAuthed) return
    const seenAt = new Date().toISOString()
    // Optimistic: clear the badge immediately.
    qc.setQueryData(qk.unreadCount(did), 0)
    try {
      await agent.app.bsky.notification.updateSeen({ seenAt })
    } finally {
      // Reconcile against the server's view of unseen.
      qc.invalidateQueries({ queryKey: qk.unreadCount(did) })
    }
  }, [agent, did, isAuthed, qc])
}
