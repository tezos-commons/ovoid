import { useCallback, useState } from 'react'
import { makePublicAgent } from '@/lib/api/public-agent'

/**
 * Closed-beta gate. While Ovoid is in dev, only verified Tezos users on Bluesky
 * (the tezoscommons.org list) may sign in. We resolve the entered handle to a
 * DID and check it against the list's membership (both via the unauthenticated
 * public AppView) BEFORE handing off to OAuth.
 *
 * List: https://bsky.app/profile/tezoscommons.org/lists/3mm5sncuz2s2v
 */
const LIST_OWNER_HANDLE = 'tezoscommons.org'
const LIST_RKEY = '3mm5sncuz2s2v'
export const ACCESS_LIST_URL =
  'https://bsky.app/profile/tezoscommons.org/lists/3mm5sncuz2s2v'

// The allow-set is identical for every visitor, so load it once and reuse the
// promise across checks. A failed load clears itself so the next check retries.
let membersPromise: Promise<Set<string>> | null = null

async function loadMembers(): Promise<Set<string>> {
  const agent = makePublicAgent()
  const owner = await agent.com.atproto.identity.resolveHandle({ handle: LIST_OWNER_HANDLE })
  const listUri = `at://${owner.data.did}/app.bsky.graph.list/${LIST_RKEY}`

  const dids = new Set<string>()
  let cursor: string | undefined
  do {
    const res = await agent.app.bsky.graph.getList({ list: listUri, limit: 100, cursor })
    for (const item of res.data.items) dids.add(item.subject.did)
    cursor = res.data.cursor
  } while (cursor)
  return dids
}

function listMembers(): Promise<Set<string>> {
  if (!membersPromise) {
    membersPromise = loadMembers().catch((err) => {
      membersPromise = null
      throw err
    })
  }
  return membersPromise
}

/** Resolve a handle (or pass a did:… through) to a DID via the public AppView. */
async function resolveDid(input: string): Promise<string> {
  const v = input.trim().replace(/^@/, '')
  if (v.startsWith('did:')) return v
  const agent = makePublicAgent()
  const res = await agent.com.atproto.identity.resolveHandle({ handle: v })
  return res.data.did
}

function messageFor(err: unknown): string {
  if (err instanceof Error) {
    if (/resolve|not.?found|unable to resolve|invalid handle/i.test(err.message)) {
      return 'Could not find that account. Check the handle and try again.'
    }
    if (/network|fetch|failed to fetch/i.test(err.message)) {
      return 'Network error while checking access. Try again.'
    }
    return err.message
  }
  return 'Something went wrong. Please try again.'
}

export type AccessStatus = 'idle' | 'checking' | 'allowed' | 'denied'

export interface BetaAccess {
  status: AccessStatus
  /** The resolved DID once a check has run (allowed or denied). */
  did: string | null
  error: string | null
  /** Resolve the handle and test list membership. */
  check: (handle: string) => Promise<void>
  /** Return to the idle (re-enter handle) state. */
  reset: () => void
}

export function useBetaAccess(): BetaAccess {
  const [status, setStatus] = useState<AccessStatus>('idle')
  const [did, setDid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async (handle: string) => {
    const v = handle.trim()
    if (!v) {
      setError('Enter your handle (e.g. alice.bsky.social).')
      return
    }
    setError(null)
    setStatus('checking')
    try {
      const resolved = await resolveDid(v)
      const allow = await listMembers()
      setDid(resolved)
      setStatus(allow.has(resolved) ? 'allowed' : 'denied')
    } catch (err) {
      setStatus('idle')
      setDid(null)
      setError(messageFor(err))
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setDid(null)
    setError(null)
  }, [])

  return { status, did, error, check, reset }
}
