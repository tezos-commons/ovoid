import { proxyImage } from '@/components/embeds/providers/objkt-data'

/**
 * Thin TzKT (api.tzkt.io) client for the profile Wallet tab. TzKT is a public
 * Tezos indexer — no auth, permissive CORS — so we hit it directly from the
 * browser. We only read: account tez balance, fungible/NFT token balances, and
 * recent transactions. Images (token icons / NFT art) are ipfs:// URIs, run
 * through the existing img.tcinfra.net proxy (proxyImage) like the objkt tabs.
 */

const TZKT = 'https://api.tzkt.io/v1'

async function tzkt<T>(path: string): Promise<T> {
  const res = await fetch(`${TZKT}${path}`)
  if (!res.ok) throw new Error(`tzkt ${res.status}`)
  return res.json() as Promise<T>
}

/** Tez (ꜩ) unicode symbol, matching the objkt price formatter. */
export const TEZ_SYMBOL = 'ꜩ'

/**
 * mutez (1e-6 tez) → trimmed decimal string. Caps fractional digits and strips
 * trailing zeros so "1.500000" reads "1.5" and "2000000" reads "2".
 */
export function formatTez(mutez: number, maxDecimals = 4): string {
  const tez = mutez / 1_000_000
  if (!Number.isFinite(tez)) return '0'
  return tez.toFixed(maxDecimals).replace(/\.?0+$/, '') || '0'
}

/** Display a raw fungible amount with thousands separators, ≤4 decimals. */
function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

/* ----------------------------------------------------------- account balance */

interface TzAccount {
  balance?: number // mutez
  type?: string
}

/** Spendable tez balance, in mutez (0 for empty/unseen accounts — TzKT 200s). */
export async function fetchTezBalance(addr: string): Promise<number> {
  const a = await tzkt<TzAccount>(`/accounts/${addr}`)
  return a.balance ?? 0
}

/* ------------------------------------------------------------ token balances */

interface TzTokenMeta {
  name?: string
  symbol?: string
  decimals?: string
  thumbnailUri?: string
  displayUri?: string
  artifactUri?: string
  icon?: string
}
interface TzTokenBalance {
  balance: string
  token: {
    contract: { address: string; alias?: string }
    tokenId: string
    standard?: string
    metadata?: TzTokenMeta
  }
}

export interface FungibleToken {
  key: string
  contract: string
  tokenId: string
  symbol: string
  name: string
  /** Human-readable balance string (raw / 10^decimals, formatted). */
  amount: string
  thumb?: string
}

/**
 * Fungible token balances (FA1.2 + FA2 with decimals > 0), richest first. The
 * `decimals.ne=0` filter drops NFTs server-side; we re-validate client-side
 * (positive decimals, positive balance, has a symbol/name) so tokens with
 * missing/garbage metadata don't leak in.
 */
export async function fetchFungibles(addr: string): Promise<FungibleToken[]> {
  const rows = await tzkt<TzTokenBalance[]>(
    `/tokens/balances?account=${addr}&balance.gt=0&token.metadata.decimals.ne=0&sort.desc=balance&limit=100`,
  )
  return rows.flatMap((r) => {
    const m = r.token.metadata
    const decimals = m?.decimals ? parseInt(m.decimals, 10) : NaN
    if (!Number.isFinite(decimals) || decimals <= 0) return []
    const amount = Number(r.balance) / 10 ** decimals
    if (!(amount > 0)) return []
    const symbol = (m?.symbol || m?.name || '').trim()
    if (!symbol) return []
    return [
      {
        key: `${r.token.contract.address}:${r.token.tokenId}`,
        contract: r.token.contract.address,
        tokenId: r.token.tokenId,
        symbol,
        name: (m?.name || symbol).trim(),
        amount: formatAmount(amount),
        thumb: proxyImage(m?.thumbnailUri || m?.icon, 'tiny'),
      },
    ]
  })
}

export interface WalletNft {
  key: string
  contract: string
  tokenId: string
  name: string
  thumb?: string
}

/**
 * Owned NFTs (decimals = 0), most recently acquired first. Only entries with a
 * renderable image are kept. `limit`/`offset` page the preview grid.
 */
export async function fetchOwnedNfts(addr: string, limit: number, offset = 0): Promise<WalletNft[]> {
  const rows = await tzkt<TzTokenBalance[]>(
    `/tokens/balances?account=${addr}&balance.gt=0&token.metadata.decimals=0&sort.desc=lastLevel&limit=${limit}&offset=${offset}`,
  )
  return rows.flatMap((r) => {
    const m = r.token.metadata
    const img = m?.displayUri || m?.thumbnailUri || m?.artifactUri
    if (!img) return []
    return [
      {
        key: `${r.token.contract.address}:${r.token.tokenId}`,
        contract: r.token.contract.address,
        tokenId: r.token.tokenId,
        name: (m?.name || `#${r.token.tokenId}`).trim(),
        thumb: proxyImage(img, 'thumb'),
      },
    ]
  })
}

/** Total owned-NFT count (for the "view all" affordance). */
export function fetchOwnedNftCount(addr: string): Promise<number> {
  return tzkt<number>(
    `/tokens/balances/count?account=${addr}&balance.gt=0&token.metadata.decimals=0`,
  )
}

/* -------------------------------------------------------------- transactions */

interface TzOp {
  id: number
  hash: string
  timestamp: string
  amount?: number // mutez
  status?: string
  sender?: { address: string; alias?: string }
  target?: { address: string; alias?: string }
  parameter?: { entrypoint?: string }
}

export interface WalletTx {
  id: number
  hash: string
  timestamp: string
  direction: 'in' | 'out' | 'self'
  /** The other side of the transfer (alias if TzKT knows one). */
  party: { address: string; alias?: string }
  amount: number // mutez
  /** Contract entrypoint, if this was a contract call rather than a plain send. */
  entrypoint?: string
  status: string
}

/**
 * Last `limit` transfers touching this account (newest first — TzKT returns
 * operations sorted by id desc). Direction is derived from whether the account is
 * the sender, target, or both.
 *
 * TzKT's account-operations endpoint also returns INTERNAL legs the account only
 * *initiated* — e.g. when you buy an NFT, the marketplace forwards your payment to
 * the seller as an internal tx (sender = the contract, target = the seller, you =
 * initiator). The account is neither side of that transfer, so it must not be
 * counted as "received" (it would read as +price incoming); it's already covered
 * by the top-level call you sent. We drop those, keeping only ops where the
 * account is genuinely the sender or the target. We over-fetch to refill the
 * holes the filter leaves, then trim to `limit`.
 */
export async function fetchActivity(addr: string, limit = 25): Promise<WalletTx[]> {
  const ops = await tzkt<TzOp[]>(`/accounts/${addr}/operations?type=transaction&limit=${limit * 2}`)
  const txs: WalletTx[] = []
  for (const o of ops) {
    const isSender = o.sender?.address === addr
    const isTarget = o.target?.address === addr
    if (!isSender && !isTarget) continue // internal leg the account only initiated
    const direction: WalletTx['direction'] = isSender && isTarget ? 'self' : isSender ? 'out' : 'in'
    const party = (isSender ? o.target : o.sender) ?? { address: '' }
    txs.push({
      id: o.id,
      hash: o.hash,
      timestamp: o.timestamp,
      direction,
      party,
      amount: o.amount ?? 0,
      entrypoint: o.parameter?.entrypoint,
      status: o.status ?? 'applied',
    })
    if (txs.length >= limit) break
  }
  return txs
}
