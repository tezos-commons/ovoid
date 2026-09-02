import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { getPublic, putPublic } from '@/lib/backend/client'

/**
 * Per-account wallet visibility, stored in the backend.ovoid.at PUBLIC namespace.
 *
 * The wallet data itself is public (a published Tezos address read through public
 * block explorers), so this is a comfort control, not a security boundary: it
 * decides which wallet sections render on the profile, not who *can* see the
 * chain. The record is written by the owner and read by any authenticated viewer
 * before rendering another account's Wallet tab.
 *
 * Model is opt-out: an absent record — or a record missing a field — means the
 * section is shown. The owner only stores the record to hide something. Reads
 * require the viewer's own service-auth token, so a logged-out viewer can't read
 * it; callers disable the query there and fall back to "show all" (consistent
 * with the data being public on-chain regardless).
 */

const KEY = 'wallet-visibility'
const SCHEMA_VERSION = 1

export interface WalletVisibility {
  balance: boolean
  tokens: boolean
  activity: boolean
  nfts: boolean
}

export const ALL_VISIBLE: WalletVisibility = {
  balance: true,
  tokens: true,
  activity: true,
  nfts: true,
}

interface StoredVisibility extends Partial<WalletVisibility> {
  v?: number
}

/** A field is visible unless explicitly stored as false (opt-out default). */
function normalize(rec: StoredVisibility | null): WalletVisibility | null {
  if (!rec) return null
  return {
    balance: rec.balance !== false,
    tokens: rec.tokens !== false,
    activity: rec.activity !== false,
    nfts: rec.nfts !== false,
  }
}

export function walletVisibilityOptions(agent: Agent, creatorDid: string) {
  return queryOptions({
    queryKey: qk.walletVisibility(creatorDid),
    queryFn: () => getPublic<StoredVisibility>(agent, creatorDid, KEY).then(normalize),
    // Slow-moving config; a short stale window keeps revisits cheap while still
    // catching an owner's change in the background (SWR).
    staleTime: 5 * 60_000,
  })
}

/**
 * Resolve the sections a viewer may see. The owner always sees every section of
 * their own wallet (the toggles live in settings); for others, a null/undefined
 * record (absent, still loading, or unreadable) defaults to fully visible.
 */
export function resolveWalletSections(
  isSelf: boolean,
  record: WalletVisibility | null | undefined,
): WalletVisibility {
  if (isSelf) return ALL_VISIBLE
  return record ?? ALL_VISIBLE
}

/**
 * Viewer-side read of an account's wallet visibility. Pass `enabled: false` when
 * logged out or viewing your own profile — the resolver then yields the defaults.
 */
export function useWalletVisibility(creatorDid: string | undefined, opts: { enabled: boolean }) {
  const { agent } = useAgent()
  return useQuery({
    ...walletVisibilityOptions(agent, creatorDid ?? ''),
    enabled: opts.enabled && !!creatorDid,
  })
}

/** Owner-side read of their own record, for the settings toggles. */
export function useMyWalletVisibility() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...walletVisibilityOptions(agent, did ?? ''),
    enabled: isAuthed && !!did,
  })
}

/** Owner-side write. Stores the full record; patches the cache so the UI is instant. */
export function useSetWalletVisibility() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: WalletVisibility) => putPublic(agent, KEY, { v: SCHEMA_VERSION, ...v }),
    onSuccess: (_size, v) => {
      if (did) qc.setQueryData(qk.walletVisibility(did), v)
    },
  })
}
