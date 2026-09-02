/**
 * The single, app-wide Tezos wallet session.
 *
 * There is exactly ONE DAppClient for the whole app, created lazily and never
 * destroyed. octez.connect (Beacon lineage) persists the active account in
 * localStorage, so this one client is reused across everything that touches the
 * wallet — the onboarding/settings link flow AND interactive-artifact
 * operations — and survives reloads. A user connects once; every later
 * wallet action reuses that connection and its wallet.
 *
 * (Before this, linking created a fresh client per attempt and destroyed it, so
 * nothing was reusable — that's the behavior this replaces.)
 */

// Loaded lazily: the SDK + its Buffer polyfill are heavy and only needed once
// the wallet is actually used.
type DAppClientT = import('@tezos-x/octez.connect-sdk').DAppClient
type SigningTypeT = typeof import('@tezos-x/octez.connect-sdk').SigningType

let clientPromise: Promise<DAppClientT> | null = null

async function getClient(): Promise<DAppClientT> {
  if (!clientPromise) {
    clientPromise = (async () => {
      // octez.connect expects a Node Buffer global; polyfill before it loads.
      if (!('Buffer' in globalThis)) {
        const { Buffer } = await import('buffer')
        ;(globalThis as Record<string, unknown>).Buffer = Buffer
      }
      const { DAppClient, NetworkType } = await import('@tezos-x/octez.connect-sdk')
      return new DAppClient({ name: 'Ovoid', network: { type: NetworkType.MAINNET } })
    })()
  }
  return clientPromise
}

export interface WalletAccount {
  address: string
  publicKey?: string
}

/** The currently connected account, or null if none — never prompts. */
export async function getActiveWallet(): Promise<WalletAccount | null> {
  const client = await getClient()
  const acc = await client.getActiveAccount()
  return acc ? { address: acc.address, publicKey: acc.publicKey } : null
}

/** Prompt the wallet picker (only when not already connected) and return the
 *  active account. Reuses the persisted account when one exists. */
export async function connectWallet(): Promise<WalletAccount> {
  const client = await getClient()
  const existing = await client.getActiveAccount()
  if (existing) return { address: existing.address, publicKey: existing.publicKey }
  const perms = await client.requestPermissions()
  return { address: perms.address, publicKey: perms.publicKey }
}

/** Force the picker: drop the current account first, then request a fresh one.
 *  Used when the connected wallet must be swapped (address mismatch, relink). */
export async function switchWallet(): Promise<WalletAccount> {
  const client = await getClient()
  await client.clearActiveAccount()
  const perms = await client.requestPermissions()
  return { address: perms.address, publicKey: perms.publicKey }
}

/** Disconnect the active account (e.g. on unlink). */
export async function resetWallet(): Promise<void> {
  const client = await getClient()
  try {
    await client.clearActiveAccount()
  } catch {
    /* nothing to clear */
  }
}

/** Sign an off-chain payload with the active wallet (used by the link flow). */
export async function signPayload(payload: string): Promise<string> {
  const client = await getClient()
  const { SigningType } = (await import('@tezos-x/octez.connect-sdk')) as { SigningType: SigningTypeT }
  const res = await client.requestSignPayload({ signingType: SigningType.MICHELINE, payload })
  return res.signature
}

/** A Tezos operation as passed from an artifact over the bridge — the SDK's
 *  PartialTezosOperation shape (kind + operation-specific fields). */
export type TezosOp = Record<string, unknown> & { kind: string }

/** Forward a batch of operations to the connected wallet for signing +
 *  injection. Returns the operation hash. The wallet shows its OWN confirm
 *  screen — this is the final, uncheatable gate. */
export async function requestOperation(ops: TezosOp[]): Promise<string> {
  const client = await getClient()
  const res = await client.requestOperation({
    operationDetails: ops as never,
  })
  return res.transactionHash
}
