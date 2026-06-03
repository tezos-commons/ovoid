import { normalizeXrpcError } from '@/lib/api/errors'

/**
 * The OAuth session must carry `transition:chat.bsky` (alongside
 * `transition:generic`) for chat.bsky.* to route. Without it the chat service
 * rejects the proxied call. We can't introspect the granted scope from the
 * browser, so we infer "permission missing" from the shape of the failure:
 * an auth/forbidden status on a chat endpoint means the scope was not granted.
 *
 * Invariant: this predicate is only ever applied to errors thrown by a
 * chat.bsky.* call, so a 401/403 here unambiguously means "no DM access".
 */
export function isChatPermissionError(err: unknown): boolean {
  const n = normalizeXrpcError(err)
  if (n.status === 401 || n.status === 403) return true
  const name = n.name.toLowerCase()
  if (name.includes('auth') || name.includes('forbidden') || name.includes('permission')) {
    return true
  }
  const msg = n.message.toLowerCase()
  return (
    msg.includes('chat scope') ||
    msg.includes('bad token scope') ||
    msg.includes('does not have permission') ||
    msg.includes('not allowed to access') ||
    msg.includes('proxy')
  )
}
