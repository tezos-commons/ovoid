import type { QueryClient } from '@tanstack/react-query'
import type { ChatBskyConvoDefs } from '@atproto/api'
import { qk } from '@/lib/query-keys'

/**
 * Most group mutations (editGroup, addMembers, lock/unlock, approveJoinRequest)
 * return the full updated `ConvoView`. Write it straight into the single-convo
 * cache so the header/settings reflect the change immediately, and invalidate
 * the list so its row (name, member count, last activity) reconciles on the next
 * poll. Centralized so every mutation keeps the two caches coherent.
 */
export function applyConvo(
  qc: QueryClient,
  did: string | undefined,
  convo: ChatBskyConvoDefs.ConvoView,
): void {
  qc.setQueryData(qk.convo(did, convo.id), convo)
  qc.invalidateQueries({ queryKey: qk.convos(did) })
}
