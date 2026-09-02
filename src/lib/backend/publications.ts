import type { Agent } from '@atproto/api'
import { BACKEND_URL, backendServiceToken } from './client'

/**
 * Client for the Ovoid Backend Publications API (backend.ovoid.at) — a globally-unique
 * `subdomain → at-uri` registry the subdomain-routing service resolves. Same
 * service-auth model as the blob client (a single-purpose token per call); the
 * authenticated DID is the registration owner. NOTE: putPublication's body is a
 * RAW `at://` URI string, not JSON.
 */

const NS = 'app.ovoid.backend'

export interface PublicationReg {
  subdomain: string
  creator: string
  uri: string
  createdAt: number
  updatedAt: number
}

/** A typed registry error carrying the API's error `code` for UI handling. */
export class PublicationError extends Error {
  code: string
  status: number
  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'PublicationError'
    this.code = code
    this.status = status
  }
}

const sub = (s: string) => encodeURIComponent(s)

async function call(
  agent: Agent,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  lxm: string,
  rawBody?: string,
): Promise<Response> {
  const token = await backendServiceToken(agent, lxm)
  return fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(rawBody !== undefined ? { 'Content-Type': 'text/plain' } : {}),
    },
    body: rawBody,
  })
}

async function fail(res: Response): Promise<never> {
  let code = `HTTP${res.status}`
  let message = `publications: ${res.status}`
  try {
    const e = (await res.json()) as { error?: string; message?: string }
    if (e.error) code = e.error
    if (e.message) message = e.message
  } catch {
    /* non-JSON error body */
  }
  throw new PublicationError(code, res.status, message)
}

/** Register or update a subdomain → at-uri. The uri must be in the caller's repo. */
export async function putPublicationReg(agent: Agent, subdomain: string, uri: string): Promise<void> {
  const res = await call(agent, 'POST', `/publications/${sub(subdomain)}`, `${NS}.putPublication`, uri)
  if (!res.ok) await fail(res)
}

/** Resolve a subdomain, or null if not registered. */
export async function getPublicationReg(agent: Agent, subdomain: string): Promise<PublicationReg | null> {
  const res = await call(agent, 'GET', `/publications/${sub(subdomain)}`, `${NS}.getPublication`)
  if (res.status === 404) return null
  if (!res.ok) await fail(res)
  return (await res.json()) as PublicationReg
}

/** Delete the caller's own registration. Returns whether a row was removed. */
export async function deletePublicationReg(agent: Agent, subdomain: string): Promise<boolean> {
  const res = await call(agent, 'DELETE', `/publications/${sub(subdomain)}`, `${NS}.deletePublication`)
  if (!res.ok) await fail(res)
  return ((await res.json()) as { deleted: boolean }).deleted
}

/** List the caller's own registrations. */
export async function listPublicationRegs(agent: Agent): Promise<PublicationReg[]> {
  const res = await call(agent, 'GET', '/publications/me', `${NS}.listPublication`)
  if (!res.ok) await fail(res)
  return ((await res.json()) as { publications: PublicationReg[] }).publications
}
