import { queryOptions, useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import {
  fetchActivity,
  fetchFungibles,
  fetchOwnedNftCount,
  fetchOwnedNfts,
  fetchTezBalance,
} from './tzkt'

/** Owned-NFT preview size on the wallet overview (full browse lives in Owned). */
export const WALLET_NFT_PREVIEW = 18

// On-chain data moves only when the account transacts; a short stale window
// keeps the overview fresh without polling. The entries persist to disk like the
// rest of the `tezos` cache, so a revisit paints instantly then refetches.
const WALLET_STALE = 60_000

export function walletBalanceOptions(addr: string) {
  return queryOptions({
    queryKey: qk.walletBalance(addr),
    queryFn: () => fetchTezBalance(addr),
    staleTime: WALLET_STALE,
  })
}

export function walletTokensOptions(addr: string) {
  return queryOptions({
    queryKey: qk.walletTokens(addr),
    queryFn: () => fetchFungibles(addr),
    staleTime: WALLET_STALE,
  })
}

export function walletNftsOptions(addr: string) {
  return queryOptions({
    queryKey: qk.walletNfts(addr),
    // One entry holds the preview page + the total count, so the grid and the
    // "view all" badge come from a single cached read.
    queryFn: async () => {
      const [items, count] = await Promise.all([
        fetchOwnedNfts(addr, WALLET_NFT_PREVIEW),
        fetchOwnedNftCount(addr),
      ])
      return { items, count }
    },
    staleTime: WALLET_STALE,
  })
}

export function walletActivityOptions(addr: string) {
  return queryOptions({
    queryKey: qk.walletActivity(addr),
    queryFn: () => fetchActivity(addr, 25),
    staleTime: WALLET_STALE,
  })
}

export function useWalletBalance(addr: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({ ...walletBalanceOptions(addr ?? ''), enabled: !!addr && opts?.enabled !== false })
}

export function useWalletTokens(addr: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({ ...walletTokensOptions(addr ?? ''), enabled: !!addr && opts?.enabled !== false })
}

export function useWalletNfts(addr: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({ ...walletNftsOptions(addr ?? ''), enabled: !!addr && opts?.enabled !== false })
}

export function useWalletActivity(addr: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({ ...walletActivityOptions(addr ?? ''), enabled: !!addr && opts?.enabled !== false })
}
