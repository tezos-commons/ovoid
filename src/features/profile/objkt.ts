/**
 * Tezos / objkt integration for the profile NFT tabs.
 *
 * Two external services, neither is Bluesky XRPC:
 *   - tzbsky.com  — resolves a Bluesky DID to a *verified* Tezos address. The
 *     account holder signed a statement linking the two, so a hit means the NFTs
 *     below genuinely belong to this profile.
 *   - objkt.com   — the Tezos NFT marketplace. Its public GraphQL indexer serves
 *     the tokens a wallet created and the tokens it currently holds.
 */

import { objktGql, proxyImage, shortAddr } from '@/components/embeds/providers/objkt-data'

const TZBSKY_LOOKUP = 'https://tzbsky.com/api/lookup/did/'

/** How many items per objkt page (offset pagination), for both grids. */
export const NFT_PAGE_SIZE = 30

export type NftKind = 'created' | 'owned'

/**
 * A normalized grid token, identical shape for the Created and Owned tabs. Only
 * what the grid cell needs — the click opens the shared NftBrowser, which
 * fetches the token's full metadata (description, listings, history) itself by
 * `fa` + `tokenId`.
 */
export interface NftToken {
  /** Stable react key + identity: `<contract>:<tokenId>`. */
  key: string
  name: string
  /** Transcoded thumbnail URL (img.tcinfra.net), or undefined when there's no still image. */
  thumb: string | undefined
  /** objkt contract + token id — the address the NftBrowser opens. */
  fa: string
  tokenId: string
}

/**
 * A collection (objkt `fa` contract) the address created in or holds tokens
 * from. The Created/Owned tabs list these first; selecting one drills into its
 * tokens (scoped to this same address + kind).
 */
export interface NftCollection {
  /** Stable react key + identity: the contract address. */
  key: string
  contract: string
  name: string
  /** A representative thumbnail — a sample token's art, falling back to the collection logo. */
  thumb: string | undefined
  /** Address-scoped token count in this collection (capped — see countLabel). */
  count: number
  /** Display string for the badge, e.g. "5" or "500+" when the cap is reached. */
  countLabel: string
}

/**
 * objkt has no aggregate fields, so the per-collection count is "fetch ids and
 * count". We do it inside the collections query (a second aliased `tokens`
 * selection of just `token_id`) rather than a separate round-trip, capped so a
 * large collection can't bloat the response — beyond the cap the badge shows N+.
 */
const COLLECTION_COUNT_CAP = 500

/**
 * Resolve a DID to its verified Tezos address, or null when the account has not
 * linked a Tezos wallet. tzbsky returns `200 []` for unlinked DIDs, so the
 * empty case is not an error.
 */
export async function lookupTezosAddress(did: string): Promise<string | null> {
  // The DID goes in the path verbatim — its colons are the delimiters tzbsky
  // matches on. encodeURIComponent would turn `did:plc:…` into `did%3Aplc%3A…`,
  // which tzbsky does not match and answers with an empty `200 []`. A DID is
  // already URL-safe in canonical form (did:plc is base32; did:web percent-
  // encodes its own method-specific id), so no further escaping is needed.
  const res = await fetch(TZBSKY_LOOKUP + did)
  if (!res.ok) throw new Error(`tzbsky lookup failed: ${res.status}`)
  const rows = (await res.json()) as Array<{ chain: string; address: string }>
  return rows.find((r) => r.chain === 'tezos')?.address ?? null
}

/* --------------------------------------------------------------- collections */

interface RawFa {
  contract: string
  name: string | null
  logo: string | null
  /** Newest member token, for the thumbnail. */
  sample: Array<{ thumbnail_uri: string | null; display_uri: string | null }>
  /** Up to COLLECTION_COUNT_CAP member token ids, counted for the badge. */
  members: Array<{ token_id: string }>
}

// The `fa` (contract) set the address created in / holds from, scoped by the
// membership predicate. order_by:{contract:asc} gives offset pagination a stable
// order. Two aliased `tokens` selections on each fa: `sample` (newest, for the
// thumbnail) and `members` (ids only, counted for the badge). The two kinds
// differ only in the membership predicate.
const CREATED_MEMBER = `creators: { creator_address: { _eq: $addr } }`
const OWNED_MEMBER = `holders: { holder_address: { _eq: $addr }, quantity: { _gt: "0" } }`

const collectionsQuery = (member: string) => `query($addr: String!, $limit: Int!, $offset: Int!) {
  fa(
    where: { tokens: { ${member} } }
    order_by: { contract: asc }
    limit: $limit
    offset: $offset
  ) {
    contract name logo
    sample: tokens(where: { ${member} }, order_by: { timestamp: desc }, limit: 1) {
      thumbnail_uri display_uri
    }
    members: tokens(where: { ${member} }, limit: ${COLLECTION_COUNT_CAP}) {
      token_id
    }
  }
}`

function normalizeCollection(f: RawFa): NftCollection {
  const sample = f.sample?.[0]
  const count = f.members?.length ?? 0
  return {
    key: f.contract,
    contract: f.contract,
    name: f.name?.trim() || shortAddr(f.contract),
    thumb: proxyImage(sample?.thumbnail_uri ?? sample?.display_uri, 'thumb') ?? f.logo ?? undefined,
    count,
    countLabel: count >= COLLECTION_COUNT_CAP ? `${COLLECTION_COUNT_CAP}+` : String(count),
  }
}

/**
 * Fetch one page of the collections an address created in (kind 'created') or
 * holds tokens from (kind 'owned'). An empty array means no more pages.
 */
export async function fetchObjktCollections(
  addr: string,
  kind: NftKind,
  offset: number,
): Promise<NftCollection[]> {
  const data = await objktGql<{ fa?: RawFa[] }>(
    collectionsQuery(kind === 'created' ? CREATED_MEMBER : OWNED_MEMBER),
    { addr, limit: NFT_PAGE_SIZE, offset },
  )
  return (data.fa ?? []).map(normalizeCollection)
}

const COLLECTION_NAME_QUERY = `query($c: String!) { fa(where: { contract: { _eq: $c } }, limit: 1) { name } }`

/**
 * Resolve a single collection's display name from its contract — for the
 * drilled-in header when the contract comes from the URL (deep link / refresh)
 * and the collection list isn't loaded. Falls back to the shortened address.
 */
export async function fetchCollectionName(contract: string): Promise<string> {
  const data = await objktGql<{ fa?: Array<{ name: string | null }> }>(COLLECTION_NAME_QUERY, {
    c: contract,
  })
  return data.fa?.[0]?.name?.trim() || shortAddr(contract)
}

/* --------------------------------------------------------- tokens in a collection */

interface RawToken {
  token_id: string
  name: string | null
  thumbnail_uri: string | null
  display_uri: string | null
  fa_contract: string
}

const CREATED_TOKENS_QUERY = `query($addr: String!, $c: String!, $limit: Int!, $offset: Int!) {
  token(
    where: { creators: { creator_address: { _eq: $addr } }, fa_contract: { _eq: $c } }
    order_by: { timestamp: desc }
    limit: $limit
    offset: $offset
  ) { token_id name thumbnail_uri display_uri fa_contract }
}`

const OWNED_TOKENS_QUERY = `query($addr: String!, $c: String!, $limit: Int!, $offset: Int!) {
  token_holder(
    where: { holder_address: { _eq: $addr }, quantity: { _gt: "0" }, token: { fa_contract: { _eq: $c } } }
    order_by: { token: { timestamp: desc } }
    limit: $limit
    offset: $offset
  ) { token { token_id name thumbnail_uri display_uri fa_contract } }
}`

function normalize(t: RawToken): NftToken {
  return {
    key: `${t.fa_contract}:${t.token_id}`,
    name: t.name?.trim() || `#${t.token_id}`,
    // Small transcoded preset; falls back to the display image when there's no
    // dedicated thumbnail.
    thumb: proxyImage(t.thumbnail_uri ?? t.display_uri, 'thumb'),
    fa: t.fa_contract,
    tokenId: t.token_id,
  }
}

/**
 * Fetch one page of an address's created or owned tokens *within a single
 * collection* (fa contract). An empty array means no more pages.
 */
export async function fetchObjktTokens(
  addr: string,
  kind: NftKind,
  contract: string,
  offset: number,
): Promise<NftToken[]> {
  const data = await objktGql<{
    token?: RawToken[]
    token_holder?: Array<{ token: RawToken }>
  }>(kind === 'created' ? CREATED_TOKENS_QUERY : OWNED_TOKENS_QUERY, {
    addr,
    c: contract,
    limit: NFT_PAGE_SIZE,
    offset,
  })
  const raw =
    kind === 'created' ? (data.token ?? []) : (data.token_holder ?? []).map((h) => h.token)
  return raw.map(normalize)
}
