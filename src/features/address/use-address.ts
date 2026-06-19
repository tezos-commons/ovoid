import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { TabItem } from '@/components'
import { qk } from '@/lib/query-keys'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { runWhenIdle } from '@/lib/idle'
import { useAgent } from '@/lib/api/agent'
import { profileOptions } from '@/features/profile/use-profile'
import { objktCollectionsOptions } from '@/features/profile/use-nfts'
import { fetchTezosAccount, lookupDidByAddress, type NftKind, type TezosAccount } from '@/features/profile/objkt'

// A verified wallet link is a one-time signed statement, and objkt identity moves
// rarely — hold both long, like the rest of the tezos cache.
const STABLE = 60 * 60 * 1000

export function addressDidOptions(address: string) {
  return queryOptions<string | null>({
    queryKey: qk.tezosDidByAddress(address),
    queryFn: () => lookupDidByAddress(address),
    staleTime: STABLE,
  })
}

export function tezosAccountOptions(address: string) {
  return queryOptions<TezosAccount>({
    queryKey: qk.tezosAccount(address),
    queryFn: () => fetchTezosAccount(address),
    staleTime: STABLE,
  })
}

/** The Bluesky DID that linked this address (tzbsky), or null. */
export function useAddressDid(address: string) {
  return useQuery({ ...addressDidOptions(address), enabled: !!address })
}

/** objkt identity (name / avatar) for the address. */
export function useTezosAccount(address: string) {
  return useQuery({ ...tezosAccountOptions(address), enabled: !!address })
}

export interface ResolvedProfile {
  name: string | undefined
  avatar: string | undefined
  /** bsky handle, when linked. */
  handle: string | undefined
  /** the tz address, when this is a Tezos identity. */
  address: string | undefined
  /** linked (or given) Bluesky DID, when any. */
  did: string | undefined
  /** in-app route to the full profile: bsky profile if linked, else the tz one. */
  path: string | undefined
  /** true when resolved to a linked Bluesky account. */
  isBsky: boolean
  isLoading: boolean
}

/**
 * Resolve an on-chain creator / author to a displayable identity + profile link.
 * `id` is a tz address or a Bluesky DID:
 *   - tz → reverse-looked-up via tzbsky; if it maps to a DID, the Bluesky profile
 *     (name/avatar) wins and the link points at /profile/<did>; otherwise the
 *     objkt identity, linking to the standalone /address/<tz> profile.
 *   - did → the Bluesky profile directly.
 * Shared by the events feed and the token viewer.
 */
export function useEntityProfile(id: string | undefined): ResolvedProfile {
  const { agent } = useAgent()
  const isTz = !!id && id.startsWith('tz')
  const isDid = !!id && id.startsWith('did:')

  const didQ = useAddressDid(isTz ? id : '')
  const did = isDid ? id : (didQ.data ?? undefined)
  const profile = useQuery({ ...profileOptions(agent, did ?? ''), enabled: !!did })
  const account = useTezosAccount(isTz ? id : '')

  if (did) {
    return {
      name:
        profile.data?.displayName?.trim() ||
        (profile.data?.handle ? `@${profile.data.handle}` : undefined),
      avatar: profile.data?.avatar,
      handle: profile.data?.handle,
      address: isTz ? id : undefined,
      did,
      path: `/profile/${did}`,
      isBsky: true,
      isLoading: profile.isLoading,
    }
  }
  if (isTz) {
    return {
      name: account.data?.name,
      avatar: account.data?.avatar,
      handle: undefined,
      address: id,
      did: undefined,
      path: `/address/${id}`,
      isBsky: false,
      isLoading: didQ.isLoading || account.isLoading,
    }
  }
  return {
    name: undefined,
    avatar: undefined,
    handle: undefined,
    address: undefined,
    did: undefined,
    path: undefined,
    isBsky: false,
    isLoading: false,
  }
}

/** The only two sections of an address profile. */
export const ADDRESS_TABS: TabItem[] = [
  { key: 'created', label: 'Created' },
  { key: 'owned', label: 'Owned' },
]

/**
 * Created/Owned tab state, shared by the desktop and mobile address profiles
 * (the nav and the content live in different DOM places, so the state lives
 * here). The active tab is in the URL (`?tab`, default created) and switching
 * clears any drilled-in `?collection`. Also warms the inactive tab on idle.
 */
export function useAddressTab(address: string): { tab: NftKind; setTab: (key: string) => void } {
  const [params, setParams] = useSearchParams()
  const tab: NftKind = params.get('tab') === 'owned' ? 'owned' : 'created'

  const setTab = (key: string) => {
    const next = new URLSearchParams(params)
    if (key === 'created') next.delete('tab')
    else next.set('tab', key)
    next.delete('collection')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!address) return
    return runWhenIdle(() => {
      for (const kind of ['created', 'owned'] as const) {
        const opts = objktCollectionsOptions(address, kind)
        schedulePrefetch(opts.queryKey, () => queryClient.prefetchInfiniteQuery(opts))
      }
    })
  }, [address])

  return { tab, setTab }
}
