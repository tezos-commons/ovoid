/**
 * Detecting a Tezos address typed into search and routing it to its standalone
 * view. Detection is purely syntactic so navigation stays synchronous; the
 * destination screen does the network classification:
 *   - KT1… (originated contract) → /contract, classified via TzKT.
 *   - tz1/tz2/tz3… (account)      → /address, reverse-looked-up via tzbsky.
 */

// Both are base58 (Bitcoin alphabet, no 0OIl) + 33 chars after the 3-char prefix.
const KT1 = /^KT1[1-9A-HJ-NP-Za-km-z]{33}$/
const TZ_ACCOUNT = /^tz[123][1-9A-HJ-NP-Za-km-z]{33}$/

/** The input as a Tezos contract address, or null if it isn't one. */
export function tezosContractAddress(input: string): string | null {
  const s = input.trim()
  return KT1.test(s) ? s : null
}

/** The input as a Tezos account (tz1/tz2/tz3) address, or null. */
export function tezosAccountAddress(input: string): string | null {
  const s = input.trim()
  return TZ_ACCOUNT.test(s) ? s : null
}

export function contractPath(contract: string): string {
  return `/contract/${contract}`
}

export function addressPath(address: string): string {
  return `/address/${address}`
}

/**
 * The route a Tezos contract/account address typed into search should go to, or
 * null when the input is an ordinary text query. One chokepoint for every search
 * entry surface.
 */
export function tezosEntityPath(input: string): string | null {
  const contract = tezosContractAddress(input)
  if (contract) return contractPath(contract)
  const account = tezosAccountAddress(input)
  if (account) return addressPath(account)
  return null
}
