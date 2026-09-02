import type { Agent } from '@atproto/api'

/**
 * Client for the Ovoid Backend (backend.ovoid.at) — the consolidated
 * first-party AT Protocol service; this module covers its per-account JSON
 * blobs (private settings + public profile data).
 * Like the poll/notify clients it holds NO credentials: every call is
 * authenticated with a single-purpose atproto service-auth JWT minted by the
 * user's PDS (com.atproto.server.getServiceAuth) with aud = the service DID and
 * lxm = the operation NSID, so a token is spendable on exactly one operation and
 * expires in ~60s. Reads are authed too — even public reads require a token.
 *
 * Private blobs are only ever the caller's own. Public blobs are keyed to the
 * creator's DID and readable by any authenticated account.
 */

/** Base URL of the backend service. */
export const BACKEND_URL = 'https://backend.ovoid.at'
/** The service's DID — the `aud` of every minted token. */
export const BACKEND_DID = 'did:web:backend.ovoid.at'

const NS = 'app.ovoid.backend'

/** Metadata for one key in a listing. `size` is the compressed byte length. */
export interface BlobMeta {
  key: string
  size: number
  createdAt: number
  updatedAt: number
}

interface ApiError {
  error?: string
  message?: string
}

/**
 * Mint a single-purpose service-auth token for one backend operation
 * (aud = the service DID, lxm = the operation NSID, ~60s expiry). Exposed so the
 * publications client — whose POST body is a raw string, not JSON — can reuse
 * the same auth without going through `req`.
 */
export async function backendServiceToken(agent: Agent, lxm: string): Promise<string> {
  const { data } = await agent.com.atproto.server.getServiceAuth({ aud: BACKEND_DID, lxm })
  return data.token
}

// A 404 is a normal "no such key" answer for reads, not an error — callers map
// it to null, so req lets it through; every other non-2xx throws.
async function req(
  agent: Agent,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  lxm: string,
  body?: unknown,
): Promise<Response> {
  const token = await backendServiceToken(agent, lxm)
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok && res.status !== 404) {
    let message = `backend ${path}: ${res.status}`
    try {
      const e = (await res.json()) as ApiError
      if (e?.message) message = e.message
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message)
  }
  return res
}

const seg = (s: string) => encodeURIComponent(s)

// --- private ---

/** Read the caller's private blob at `key`, or null if unset. */
export async function getPrivate<T = unknown>(agent: Agent, key: string): Promise<T | null> {
  const res = await req(agent, 'GET', `/private/me/${seg(key)}`, `${NS}.getPrivate`)
  return res.status === 404 ? null : ((await res.json()) as T)
}

/** Upsert the caller's private blob at `key`. Returns the stored compressed size. */
export async function putPrivate(agent: Agent, key: string, value: unknown): Promise<number> {
  const res = await req(agent, 'POST', `/private/me/${seg(key)}`, `${NS}.putPrivate`, value)
  return ((await res.json()) as { size: number }).size
}

export async function deletePrivate(agent: Agent, key: string): Promise<void> {
  await req(agent, 'DELETE', `/private/me/${seg(key)}`, `${NS}.deletePrivate`)
}

export async function listPrivate(agent: Agent): Promise<BlobMeta[]> {
  const res = await req(agent, 'GET', '/private/me', `${NS}.listPrivate`)
  return ((await res.json()) as { keys: BlobMeta[] }).keys
}

// --- public ---

/** Read a public blob keyed to any `did`, or null if unset. */
export async function getPublic<T = unknown>(
  agent: Agent,
  did: string,
  key: string,
): Promise<T | null> {
  const res = await req(agent, 'GET', `/public/${seg(did)}/${seg(key)}`, `${NS}.getPublic`)
  return res.status === 404 ? null : ((await res.json()) as T)
}

/** Read the caller's own public blob at `key`, or null if unset. */
export async function getMyPublic<T = unknown>(agent: Agent, key: string): Promise<T | null> {
  const res = await req(agent, 'GET', `/public/me/${seg(key)}`, `${NS}.getPublic`)
  return res.status === 404 ? null : ((await res.json()) as T)
}

/** Upsert the caller's public blob at `key`. Returns the stored compressed size. */
export async function putPublic(agent: Agent, key: string, value: unknown): Promise<number> {
  const res = await req(agent, 'POST', `/public/me/${seg(key)}`, `${NS}.putPublic`, value)
  return ((await res.json()) as { size: number }).size
}

export async function deletePublic(agent: Agent, key: string): Promise<void> {
  await req(agent, 'DELETE', `/public/me/${seg(key)}`, `${NS}.deletePublic`)
}

/** List public keys for any `did`. */
export async function listPublic(agent: Agent, did: string): Promise<BlobMeta[]> {
  const res = await req(agent, 'GET', `/public/${seg(did)}`, `${NS}.listPublic`)
  return ((await res.json()) as { keys: BlobMeta[] }).keys
}
