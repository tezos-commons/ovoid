import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import {
  fetchCollectionName,
  fetchObjktCollections,
  fetchObjktTokens,
  lookupTezosAddress,
  NFT_PAGE_SIZE,
  type NftCollection,
  type NftKind,
  type NftToken,
} from './objkt'

/**
 * Resolve a profile's verified Tezos address (or null). Keyed by DID and held
 * for a long time — a wallet link is a one-time signed statement, it does not
 * change between visits. `null` is a successful result (no linked wallet), not
 * an error, so it caches normally and the NFT tabs simply stay hidden.
 */
export function useTezosAddress(did: string | undefined) {
  return useQuery<string | null>({
    queryKey: qk.tezosAddress(did ?? ''),
    enabled: !!did,
    queryFn: () => lookupTezosAddress(did!),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

/**
 * Infinite list of the collections an address created in or holds from, paged by
 * offset. A short page (< NFT_PAGE_SIZE) means the end of the list.
 */
export function useObjktCollections(
  addr: string | undefined,
  kind: NftKind,
  opts?: { enabled?: boolean },
) {
  return useInfiniteQuery<NftCollection[]>({
    queryKey: qk.objktCollections(addr ?? '', kind),
    enabled: !!addr && opts?.enabled !== false,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchObjktCollections(addr!, kind, pageParam as number),
    getNextPageParam: (last, all) =>
      last.length < NFT_PAGE_SIZE ? undefined : all.length * NFT_PAGE_SIZE,
  })
}

/**
 * A single collection's display name, resolved from its contract. Used for the
 * drilled-in header; seeded from the collection list on click so it's instant,
 * and fetched on its own for deep links. Held long — a collection name is stable.
 */
export function useObjktCollectionName(contract: string | undefined) {
  return useQuery<string>({
    queryKey: qk.objktCollectionName(contract ?? ''),
    enabled: !!contract,
    queryFn: () => fetchCollectionName(contract!),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

/**
 * Infinite list of an address's created or owned tokens within a single
 * collection (contract), paged by offset. Disabled until a collection is chosen.
 */
export function useObjktTokens(
  addr: string | undefined,
  kind: NftKind,
  contract: string | undefined,
  opts?: { enabled?: boolean },
) {
  return useInfiniteQuery<NftToken[]>({
    queryKey: qk.objktTokens(addr ?? '', kind, contract ?? ''),
    enabled: !!addr && !!contract && opts?.enabled !== false,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchObjktTokens(addr!, kind, contract!, pageParam as number),
    getNextPageParam: (last, all) =>
      last.length < NFT_PAGE_SIZE ? undefined : all.length * NFT_PAGE_SIZE,
  })
}
