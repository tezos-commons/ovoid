import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * app.ovoid.indexer.getInterestingTokens — personalized NFT recommendations
 * from the Ovoid indexer (see indx/docs/api.md): up to 25 FA2 tokens the
 * caller doesn't hold, ranked by friend-graph purchase intent, each with the
 * contributing marketplace / balance events inlined.
 */

export const INDEXER_SERVICE_DID = 'did:web:indexer.ovoid.at'
const INDEXER_URL =
  (import.meta.env.VITE_INDEXER_URL as string | undefined) ?? 'https://indexer.ovoid.at'
const NSID = 'app.ovoid.indexer.getInterestingTokens'

/** Absolute URL for an indexer-relative file path (e.g. an event's actor_avatar). */
export function indexerFileUrl(path: string | null | undefined): string | undefined {
  return path ? `${INDEXER_URL}${path}` : undefined
}

export interface ShowcaseEvent {
  kind: 'objkt' | 'balance_change'
  /** The acting friend's Tezos address. */
  actor: string
  /** 1 = friend, 2 = friend-of-friend. */
  distance: number
  actor_has_atproto: boolean
  /** Linked atproto identity, when the address resolves to one. */
  actor_did: string | null
  /** Display name: bsky displayName when linked, else objkt alias/tzdomain. */
  actor_name: string | null
  actor_handle: string | null
  /** Relative path to /files/profile/thumb/{id} on the indexer (see indexerFileUrl). */
  actor_avatar: string | null
  id: string | null
  event_type: string | null
  marketplace_event_type: string | null
  /** Mutez. */
  price_xtz: number | null
  amount: number | null
  /** Epoch milliseconds (objkt events only). */
  timestamp: number | null
  ophash: string | null
  level: number | null
  balance: string | null
}

export interface ShowcaseToken {
  /** FA2 contract address (KT1…). */
  contract: string
  token_id: string
  name: string | null
  score: number
  /** Distinct friend/friend-of-friend addresses contributing events. */
  reach: number
  events: ShowcaseEvent[]
}

async function fetchInterestingTokens(agent: Agent): Promise<ShowcaseToken[]> {
  // Service-auth: a short-lived JWT minted by the caller's own PDS, bound to
  // this exact audience + endpoint (lxm). Minted fresh per fetch; the query's
  // staleTime bounds the rate.
  const auth = await agent.com.atproto.server.getServiceAuth({
    aud: INDEXER_SERVICE_DID,
    lxm: NSID,
  })
  const res = await fetch(`${INDEXER_URL}/xrpc/${NSID}`, {
    headers: { Authorization: `Bearer ${auth.data.token}` },
  })
  if (!res.ok) throw new Error(`indexer: HTTP ${res.status}`)
  const body = (await res.json()) as { tokens?: ShowcaseToken[] }
  return body.tokens ?? []
}

export function interestingTokensOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.interestingTokens(did),
    // The indexer caches results per DID for 5 minutes and asks clients not to
    // poll faster; matching staleTime makes every warm/mount within the TTL a
    // cache hit on both ends.
    staleTime: 5 * 60_000,
    queryFn: () => fetchInterestingTokens(agent),
  })
}

export function useInterestingTokens() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({ ...interestingTokensOptions(agent, did), enabled: isAuthed })
}
