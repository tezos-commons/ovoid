import type { Agent } from '@atproto/api'

/**
 * Client for the Ovoid Polls service (poll.ovoid.at) — a first-party AT Protocol
 * service. Like the notify client, it holds NO credentials: every call is
 * authenticated with a single-purpose atproto service-auth JWT minted by the
 * user's PDS (com.atproto.server.getServiceAuth) with aud = the service DID and
 * lxm = the endpoint NSID, so a token is spendable on exactly one method and
 * expires in ~60s. Reads are authed too — getPoll/getResults return per-viewer
 * state (viewerHasVoted / resultsVisible), which needs the caller's identity.
 */

/** Base URL of the polls service. */
export const POLL_URL = 'https://poll.ovoid.at'
/** The service's DID — the `aud` of every minted token. */
export const POLL_DID = 'did:web:poll.ovoid.at'

const NS = 'app.ovoid.poll'

export type PollKind = 'single' | 'multi' | 'ranked'
export type PollVisibility = 'public' | 'private'

export interface PollOption {
  idx: number
  text: string
}

export interface Poll {
  id: string
  creatorDid: string
  question: string
  kind: PollKind
  visibility: PollVisibility
  options: PollOption[]
  /** unix seconds; absent for polls with no scheduled close. */
  closesAt?: number
  closed: boolean
  createdAt: number
  voteCount: number
}

export interface GetPollResult {
  poll: Poll
  viewerHasVoted: boolean
  resultsVisible: boolean
}

export interface ResultOption {
  idx: number
  text: string
  count: number
}

export interface RankedRound {
  tallies: ResultOption[]
  eliminated: number | null
}

export interface PollResults {
  kind: PollKind
  total: number
  options: ResultOption[]
  /** ranked only */
  winnerIdx?: number | null
  rounds?: RankedRound[]
}

export interface CreatePollInput {
  question: string
  kind: PollKind
  options: string[]
  visibility: PollVisibility
  /** unix seconds, must be in the future when set. */
  closesAt?: number
}

interface ApiError {
  error?: string
  message?: string
}

async function call<T>(
  agent: Agent,
  method: 'GET' | 'POST',
  nsid: string,
  opts?: { body?: unknown; params?: Record<string, string> },
): Promise<T> {
  const {
    data: { token },
  } = await agent.com.atproto.server.getServiceAuth({ aud: POLL_DID, lxm: nsid })
  const qs = opts?.params ? `?${new URLSearchParams(opts.params)}` : ''
  const res = await fetch(`${POLL_URL}/xrpc/${nsid}${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    // The service returns {error, message}; surface the message when present.
    let message = `poll ${nsid}: ${res.status}`
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

export function createPoll(agent: Agent, input: CreatePollInput): Promise<{ id: string }> {
  return call(agent, 'POST', `${NS}.createPoll`, { body: input })
}

export function getPoll(agent: Agent, id: string): Promise<GetPollResult> {
  return call(agent, 'GET', `${NS}.getPoll`, { params: { id } })
}

export function getResults(agent: Agent, id: string): Promise<{ results: PollResults }> {
  return call(agent, 'GET', `${NS}.getResults`, { params: { id } })
}

export function vote(agent: Agent, pollId: string, choices: number[]): Promise<{ ok: boolean }> {
  return call(agent, 'POST', `${NS}.vote`, { body: { pollId, choices } })
}

export function closePoll(agent: Agent, pollId: string): Promise<{ ok: boolean }> {
  return call(agent, 'POST', `${NS}.closePoll`, { body: { pollId } })
}

/** The shareable URL we embed in a message; our renderer detects and unfurls it. */
export function pollUrl(id: string): string {
  return `${POLL_URL}/p/${id}`
}
