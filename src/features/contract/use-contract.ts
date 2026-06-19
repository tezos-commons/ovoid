import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { fetchContractInfo, type ContractInfo } from '@/features/profile/tzkt'
import {
  fetchCollectionMeta,
  fetchCollectionTokens,
  NFT_PAGE_SIZE,
  type CollectionMeta,
  type NftToken,
} from '@/features/profile/objkt'

// Contract classification and collection metadata are effectively immutable for
// a session; tokens move rarely. Hold long, like the rest of the tezos cache.
const STABLE = 60 * 60 * 1000

export function contractInfoOptions(contract: string) {
  return queryOptions<ContractInfo | null>({
    queryKey: qk.contractInfo(contract),
    queryFn: () => fetchContractInfo(contract),
    staleTime: STABLE,
  })
}

export function collectionMetaOptions(contract: string) {
  return queryOptions<CollectionMeta>({
    queryKey: qk.collection(contract),
    queryFn: () => fetchCollectionMeta(contract),
    staleTime: STABLE,
  })
}

export function collectionTokensOptions(contract: string) {
  return infiniteQueryOptions<NftToken[]>({
    queryKey: qk.collectionTokens(contract),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchCollectionTokens(contract, pageParam as number),
    getNextPageParam: (last, all) =>
      last.length < NFT_PAGE_SIZE ? undefined : all.length * NFT_PAGE_SIZE,
  })
}

export function useContractInfo(contract: string) {
  return useQuery({ ...contractInfoOptions(contract), enabled: !!contract })
}

export function useCollectionMeta(contract: string) {
  return useQuery({ ...collectionMetaOptions(contract), enabled: !!contract })
}

export function useCollectionTokens(contract: string) {
  return useInfiniteQuery({ ...collectionTokensOptions(contract), enabled: !!contract })
}
