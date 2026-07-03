import type { Agent } from '@atproto/api'

/**
 * Ovoid indexer client plumbing (indexer.ovoid.at — see indx/docs/api.md).
 * Every XRPC endpoint takes an atproto service-auth JWT minted by the
 * caller's own PDS, bound to this audience and the endpoint's NSID (lxm).
 */

export const INDEXER_SERVICE_DID = 'did:web:indexer.ovoid.at'
const INDEXER_URL =
  (import.meta.env.VITE_INDEXER_URL as string | undefined) ?? 'https://indexer.ovoid.at'

/** Absolute URL for an indexer-relative file path (e.g. an event's actor_avatar). */
export function indexerFileUrl(path: string | null | undefined): string | undefined {
  return path ? `${INDEXER_URL}${path}` : undefined
}

/** Authenticated GET against /xrpc/<nsid>. Token minted fresh per call; the
 *  callers' query staleTimes bound the rate. */
export async function indexerGet<T>(
  agent: Agent,
  nsid: string,
  params?: Record<string, string>,
): Promise<T> {
  const auth = await agent.com.atproto.server.getServiceAuth({
    aud: INDEXER_SERVICE_DID,
    lxm: nsid,
  })
  const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
  const res = await fetch(`${INDEXER_URL}/xrpc/${nsid}${qs}`, {
    headers: { Authorization: `Bearer ${auth.data.token}` },
  })
  if (!res.ok) throw new Error(`indexer: HTTP ${res.status}`)
  return (await res.json()) as T
}
