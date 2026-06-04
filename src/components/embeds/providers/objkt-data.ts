import { useQuery } from '@tanstack/react-query'

const OBJKT_GQL = 'https://data.objkt.com/v3/graphql'

/* ----------------------------------------------------------------- fetch core */

/**
 * Single objkt GraphQL client for the whole app (the profile NFT tabs import it
 * too). `text/plain` keeps this a CORS "simple request" (no preflight): objkt's
 * GraphQL preflight only allows GET/OPTIONS, so an application/json POST would
 * be blocked; Hasura parses the JSON body regardless of content-type.
 */
export async function objktGql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(OBJKT_GQL, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`objkt indexer ${res.status}`)
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors?.length) throw new Error(json.errors[0].message)
  if (!json.data) throw new Error('objkt indexer: no data')
  return json.data
}

function ipfsToHttp(uri?: string | null): string | undefined {
  if (!uri) return undefined
  return uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${uri.slice('ipfs://'.length)}` : uri
}

/**
 * Gateway URL for an interactive artifact loaded in an iframe. Uses dweb.link,
 * which redirects path requests to a per-CID *subdomain* origin — so each piece
 * runs in its own isolated origin (no shared storage/state between artifacts),
 * which is what makes `allow-same-origin` safe in the sandbox.
 */
export function ipfsToSubdomain(uri?: string | null): string | undefined {
  if (!uri) return undefined
  if (uri.startsWith('ipfs://')) return `https://dweb.link/ipfs/${uri.slice('ipfs://'.length)}`
  if (uri.startsWith('ipns://')) return `https://dweb.link/ipns/${uri.slice('ipns://'.length)}`
  return uri
}

const IMG_PROXY = 'https://img.tcinfra.net/img'
export type ImgPreset = 'tiny' | 'thumb' | 'card' | 'hero'

/**
 * On-the-fly transcoded image URL via img.tcinfra.net for an ipfs:// / ipns://
 * source: `/img/<preset>.<format>/ipfs/<cid>[/<path>]`. Presets cap a max
 * dimension (thumb 300, card 800, hero 1600) preserving aspect ratio. Non-IPFS
 * URLs pass through unchanged — the proxy is only used for IPFS content.
 */
export function proxyImage(
  uri: string | undefined | null,
  preset: ImgPreset,
  format = 'webp',
): string | undefined {
  if (!uri) return undefined
  if (uri.startsWith('ipfs://')) {
    return `${IMG_PROXY}/${preset}.${format}/ipfs/${uri.slice('ipfs://'.length)}`
  }
  if (uri.startsWith('ipns://')) {
    return `${IMG_PROXY}/${preset}.${format}/ipns/${uri.slice('ipns://'.length)}`
  }
  return uri
}

/* --------------------------------------------------------------- basic preview */

export interface TokenPreview {
  name?: string
  description?: string
  /** Raw display artwork URI (ipfs://…); proxy presets are derived from it. */
  displayUri?: string
  /** Card-preset (≤800px) transcoded display artwork — for the inline preview. */
  image?: string
  /** The full artifact (ipfs.io gateway URL) — e.g. the .glb for a 3D model. */
  artifact?: string
  /** Raw artifact URI (ipfs://…), for building an isolated iframe gateway URL. */
  artifactUri?: string
  mime?: string
  creator?: string
  creatorAddress?: string
  aspectRatio?: { width: number; height: number }
}

/** True when the token's artifact is a 3D model (renderable by <model-viewer>). */
export function isModel(t: TokenPreview | null | undefined): boolean {
  if (!t) return false
  if (t.mime?.startsWith('model/')) return true
  return /\.(glb|gltf)(\?|$)/i.test(t.artifact ?? '')
}

/** True when the artifact is a standalone audio track (cover image + player). */
export function isAudio(t: TokenPreview | null | undefined): boolean {
  return t?.mime?.startsWith('audio/') ?? false
}

const INTERACTIVE_MIMES = new Set([
  'application/x-directory',
  'text/html',
  'application/xhtml+xml',
  'application/zip',
])

/** True when the artifact is an interactive HTML piece (run in a sandboxed iframe). */
export function isInteractive(t: TokenPreview | null | undefined): boolean {
  return !!t?.mime && INTERACTIVE_MIMES.has(t.mime)
}

const BASIC_QUERY =
  'query($fa:String!,$t:String!){token(where:{fa_contract:{_eq:$fa},token_id:{_eq:$t}} limit:1){' +
  'name description display_uri thumbnail_uri artifact_uri mime dimensions ' +
  'creators{creator_address holder{alias address}}}}'

interface BasicRow {
  name?: string
  description?: string
  display_uri?: string
  thumbnail_uri?: string
  artifact_uri?: string
  mime?: string
  dimensions?: { display?: { dimensions?: { width?: number; height?: number } | null } }
  creators?: Array<{ creator_address?: string; holder?: { alias?: string; address?: string } }>
}

export function useTezosToken(fa: string | undefined, tokenId: string | undefined) {
  return useQuery<TokenPreview | null>({
    queryKey: ['embed', 'tezos-token', fa ?? '', tokenId ?? ''],
    enabled: !!fa && !!tokenId,
    staleTime: 60 * 60_000,
    retry: 1,
    queryFn: async () => {
      const data = await objktGql<{ token?: BasicRow[] }>(BASIC_QUERY, { fa, t: tokenId })
      const row = data.token?.[0]
      if (!row) return null
      const creator = row.creators?.[0]
      const holder = creator?.holder
      const dim = row.dimensions?.display?.dimensions
      const displayUri = row.display_uri || row.thumbnail_uri
      return {
        name: row.name,
        description: row.description,
        displayUri,
        image: proxyImage(displayUri, 'card'),
        artifact: ipfsToHttp(row.artifact_uri),
        artifactUri: row.artifact_uri,
        mime: row.mime,
        creator: holder?.alias || holder?.address,
        creatorAddress: creator?.creator_address || holder?.address,
        aspectRatio:
          dim?.width && dim?.height ? { width: dim.width, height: dim.height } : undefined,
      }
    },
  })
}

/* --------------------------------------------------- details (listings / offers / history) */

export interface TokenListing {
  price: number
  amount: number
  currencyId: number
  seller?: string
}
export interface TokenOffer {
  price: number
  currencyId: number
  buyer?: string
}
export interface TokenEvent {
  type: string
  price?: number
  at: string
}
export interface TokenDetails {
  supply?: number
  listings: TokenListing[]
  offers: TokenOffer[]
  events: TokenEvent[]
}

const DETAILS_QUERY =
  'query($fa:String!,$t:String!){token(where:{fa_contract:{_eq:$fa},token_id:{_eq:$t}} limit:1){' +
  'supply ' +
  'listings(where:{status:{_eq:"active"}} order_by:{price:asc} limit:10){price amount currency_id seller_address} ' +
  'offers_active(order_by:{price:desc} limit:10){price currency_id buyer_address} ' +
  'events(order_by:{timestamp:desc} limit:14){event_type marketplace_event_type price timestamp}}}'

interface DetailsRow {
  supply?: number
  listings?: Array<{ price: number; amount: number; currency_id: number; seller_address?: string }>
  offers_active?: Array<{ price: number; currency_id: number; buyer_address?: string }>
  events?: Array<{
    event_type?: string | null
    marketplace_event_type?: string | null
    price?: number | null
    timestamp: string
  }>
}

/**
 * objkt event rows carry two type fields: `marketplace_event_type` for trade
 * events (auctions / listings / offers / sales) and `event_type` for FA2 token
 * movements (mint / transfer / burn). Marketplace rows leave `event_type` null,
 * so the marketplace field MUST be read first — otherwise every auction,
 * listing, offer and sale collapses to "Transfer". Unknown codes are prettified
 * rather than mislabeled.
 */
const EVENT_LABELS: Record<string, string> = {
  english_auction_create: 'Auction created',
  english_auction_bid: 'Bid',
  english_auction_settle: 'Auction settled',
  english_auction_cancel: 'Auction cancelled',
  dutch_auction_create: 'Dutch auction',
  dutch_auction_buy: 'Sale',
  dutch_auction_cancel: 'Auction cancelled',
  list_create: 'Listed',
  ask: 'Listed',
  list_buy: 'Sale',
  list_cancel: 'Listing cancelled',
  offer_create: 'Offer',
  offer: 'Offer',
  bid: 'Offer',
  offer_accept: 'Offer accepted',
  offer_fulfill: 'Sale',
  offer_cancel: 'Offer cancelled',
  mint: 'Mint',
  transfer: 'Transfer',
  burn: 'Burn',
}

function prettifyCode(code: string): string {
  const s = code.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function eventLabel(marketplaceType?: string | null, tokenType?: string | null): string {
  const raw = marketplaceType || tokenType
  if (!raw) return 'Transfer'
  return EVENT_LABELS[raw] ?? prettifyCode(raw)
}

export function useTezosTokenDetails(
  fa: string | undefined,
  tokenId: string | undefined,
  enabled: boolean,
) {
  return useQuery<TokenDetails | null>({
    queryKey: ['embed', 'tezos-token-details', fa ?? '', tokenId ?? ''],
    enabled: enabled && !!fa && !!tokenId,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const data = await objktGql<{ token?: DetailsRow[] }>(DETAILS_QUERY, { fa, t: tokenId })
      const row = data.token?.[0]
      if (!row) return null
      return {
        supply: row.supply,
        listings: (row.listings ?? []).map((l) => ({
          price: l.price,
          amount: l.amount,
          currencyId: l.currency_id,
          seller: l.seller_address,
        })),
        offers: (row.offers_active ?? []).map((o) => ({
          price: o.price,
          currencyId: o.currency_id,
          buyer: o.buyer_address,
        })),
        events: (row.events ?? []).map((e) => ({
          type: eventLabel(e.marketplace_event_type, e.event_type),
          price: e.price ?? undefined,
          at: e.timestamp,
        })),
      }
    },
  })
}

/* ---------------------------------------------------------------- artist tokens */

export interface ArtistToken {
  fa: string
  tokenId: string
  name?: string
  image?: string
}

const ARTIST_QUERY =
  'query($addr:String!){token(where:{creators:{creator_address:{_eq:$addr}},supply:{_gt:0}} ' +
  'order_by:{timestamp:desc} limit:48){fa_contract token_id name thumbnail_uri display_uri}}'

interface ArtistRow {
  fa_contract: string
  token_id: string
  name?: string
  thumbnail_uri?: string
  display_uri?: string
}

/** Other tokens minted by a creator address (newest first), for the gallery tab. */
export function useArtistTokens(address: string | undefined, enabled: boolean) {
  return useQuery<ArtistToken[]>({
    queryKey: ['embed', 'artist-tokens', address ?? ''],
    enabled: enabled && !!address,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const data = await objktGql<{ token?: ArtistRow[] }>(ARTIST_QUERY, { addr: address })
      return (data.token ?? []).map((t) => ({
        fa: t.fa_contract,
        tokenId: t.token_id,
        name: t.name,
        // Grid tiles use the small thumb preset.
        image: proxyImage(t.thumbnail_uri || t.display_uri, 'thumb'),
      }))
    },
  })
}

/* ----------------------------------------------------------------- formatting */

/** mutez (or token base units) -> display amount. currency_id 1 is tez (ꜩ). */
export function formatPrice(mutez: number, currencyId: number): string {
  const v = mutez / 1_000_000
  const num = v >= 1 ? v.toFixed(v % 1 === 0 ? 0 : 2) : v.toPrecision(2)
  return currencyId === 1 ? `${num} ꜩ` : `${num}`
}

export function shortAddr(addr?: string): string {
  if (!addr) return ''
  if (!addr.startsWith('tz') && !addr.startsWith('KT')) return addr
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`
}
