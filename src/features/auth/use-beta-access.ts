import { useQuery } from '@tanstack/react-query'
import { makePublicAgent } from '@/lib/api/public-agent'
import { qk } from '@/lib/query-keys'

/**
 * Tezos closed-beta list. List membership is one of the two ways to access
 * Ovoid (the other is a linked wallet — see useOvoidAccess); it's checked
 * AFTER sign-in, against the signed-in DID, via the unauthenticated public
 * AppView. Members skip the wallet-connect onboarding.
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
  // The list owner (tezoscommons.org) is always allowed, even though it isn't a
  // member of its own list.
  dids.add(owner.data.did)
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

/**
 * Whether the signed-in DID is on the closed-beta list. `data === true` means
 * the user is a member (one of the two access conditions). Disabled until a DID
 * is known. Long staleTime — membership barely changes within a session, and
 * the members set is loaded once and shared across checks.
 */
export function useIsListMember(did: string | undefined) {
  return useQuery({
    queryKey: qk.tezosListMember(did ?? ''),
    enabled: !!did,
    queryFn: async () => (await listMembers()).has(did!),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  })
}
