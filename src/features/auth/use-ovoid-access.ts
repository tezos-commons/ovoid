import { useAgent } from '@/lib/api/agent'
import { useTezosAddress } from '@/features/profile/use-nfts'
import { useIsListMember } from './use-beta-access'

export interface OvoidAccess {
  /** True until we can decide either way (avoids flashing onboarding). */
  isLoading: boolean
  /** Granted when the user is on the beta list OR has a linked Tezos wallet. */
  hasAccess: boolean
}

/**
 * The app's access gate: a signed-in user may use Ovoid if they're on the
 * tezoscommons beta list OR have a Tezos wallet linked to their account. Anyone
 * else is sent to the wallet-connect onboarding.
 *
 * No-flash semantics: grant the instant EITHER source is positive (don't wait on
 * the other); report no-access only once BOTH have settled negative — list false
 * AND address null/errored. While neither is decided yet, stay loading so a user
 * who actually has access never flashes the onboarding screen. A tzbsky lookup
 * error counts as "no wallet": a list member still gets in via the list check,
 * which is independent of the (flaky) index.
 */
export function useOvoidAccess(): OvoidAccess {
  const { did, isAuthed } = useAgent()
  const listQ = useIsListMember(isAuthed ? did : undefined)
  const addrQ = useTezosAddress(isAuthed ? did : undefined)

  const isListMember = listQ.data === true
  const hasWallet = !!addrQ.data
  if (isListMember || hasWallet) return { isLoading: false, hasAccess: true }

  // Settled-negative = the query is no longer pending (resolved to false / null,
  // or errored). isPending stays true only while a fetch is genuinely in flight.
  const listSettled = !listQ.isPending || listQ.isError
  const addrSettled = !addrQ.isPending || addrQ.isError
  if (listSettled && addrSettled) return { isLoading: false, hasAccess: false }
  return { isLoading: true, hasAccess: false }
}
