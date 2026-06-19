import type { Agent } from '@atproto/api'

/**
 * Client for the Ovoid Graph service (graph.ovoid.at) — a first-party AT Protocol
 * service for the social/follow graph over Tezos identities. Like the poll/data
 * clients it holds NO credentials: every call is authenticated with a
 * single-purpose atproto service-auth JWT minted by the user's PDS
 * (com.atproto.server.getServiceAuth) with aud = the service DID and lxm = the
 * operation NSID, so a token is spendable on exactly one operation.
 *
 * The caller DID is taken from the verified token `iss`; nothing identifying the
 * caller is read from the path or body. The first write a DID makes creates its
 * identity node and kicks off a background follow-graph sync, so early reads can
 * be sparse.
 */

/** Base URL of the graph service. */
export const GRAPH_URL = 'https://graph.ovoid.at'
/** The service's DID — the `aud` of every minted token. */
export const GRAPH_DID = 'did:web:graph.ovoid.at'

const NS = 'app.ovoid.graph'

interface ApiError {
  error?: string
  message?: string
}

async function call<T>(
  agent: Agent,
  method: 'GET' | 'POST',
  path: string,
  lxm: string,
  body?: unknown,
): Promise<T> {
  const {
    data: { token },
  } = await agent.com.atproto.server.getServiceAuth({ aud: GRAPH_DID, lxm })
  const res = await fetch(`${GRAPH_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let message = `graph ${path}: ${res.status}`
    try {
      const e = (await res.json()) as ApiError
      if (e?.message) message = e.message
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

const seg = (s: string) => encodeURIComponent(s)

// --- follows ---

export interface FollowTezosResult {
  ok: boolean
  follower: string
  address: string
  created_at: number
}

/** Follow a Tezos address (idempotent). */
export function followTezos(agent: Agent, address: string): Promise<FollowTezosResult> {
  return call(agent, 'POST', `/follow/tezos/${seg(address)}`, `${NS}.followTezos`)
}

/** Whether the caller already follows the address. */
export function isFollowingTezos(agent: Agent, address: string): Promise<boolean> {
  return call<{ following: boolean }>(
    agent,
    'GET',
    `/follow/tezos/${seg(address)}`,
    `${NS}.isFollowingTezos`,
  ).then((r) => r.following)
}
