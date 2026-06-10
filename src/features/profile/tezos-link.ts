/**
 * Tezos wallet linking — publishes the same signed record tzbsky.com does,
 * but entirely client-side against the user's own PDS.
 *
 * The link is the `com.tzbsky.cryptoAddress` record at rkey `self` in the
 * user's repo. Trust derives from two signatures, neither of them ours:
 *   1. the record lives in the DID's repo (repo-key signed), and
 *   2. `proof.signature` is the wallet signing a canonical message that
 *      embeds the DID — the `did=` line is the security of the scheme.
 *
 * We reproduce tzbsky's canonical message byte-for-byte (including the
 * `tzbsky.com:` header) so records published here are indistinguishable
 * from tzbsky-published ones to any verifier — and tzbsky itself picks the
 * record up, which feeds the did→address lookup the NFT tabs use.
 */
import type { Agent } from '@atproto/api'

export const CRYPTO_ADDRESS_COLLECTION = 'com.tzbsky.cryptoAddress'

interface CryptoAddressProof {
  scheme: string
  message: string
  signature: string
}

interface CryptoAddressEntry {
  chain: string
  address: string
  publicKey?: string
  proof: CryptoAddressProof
}

interface CryptoAddressRecord {
  $type: string
  addresses: CryptoAddressEntry[]
  updatedAt: string
}

/**
 * Micheline-pack a UTF-8 string: 0x05 0x01 <4-byte BE length> <utf8 bytes>,
 * hex-encoded. This is the framing Tezos wallets sign for off-chain messages
 * (it can never collide with an on-chain operation, so the signature is not
 * replayable as a transaction).
 */
export function packMichelineString(s: string): string {
  const bytes = new TextEncoder().encode(s)
  const packed = new Uint8Array(6 + bytes.length)
  packed[0] = 0x05
  packed[1] = 0x01
  packed[2] = (bytes.length >>> 24) & 0xff
  packed[3] = (bytes.length >>> 16) & 0xff
  packed[4] = (bytes.length >>> 8) & 0xff
  packed[5] = bytes.length & 0xff
  packed.set(bytes, 6)
  return Array.from(packed, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The exact canonical message tzbsky's verifier expects (see its backend). */
function buildAddressAttestation(did: string, address: string, issuedAt: number): string {
  return `tzbsky.com: main address attestation\ndid=${did}\nchain=tezos\naddress=${address}\nissuedAt=${issuedAt}`
}

export type LinkStatus = 'connecting' | 'signing' | 'publishing'

/**
 * True when an error is the user backing out of the wallet picker / sign
 * sheet rather than a real failure. octez.connect rejects these as
 * `[ABORTED_ERROR]:The action was aborted by the user.` — match
 * case-insensitively so a cancel is silently swallowed, not surfaced.
 */
export function isUserAbort(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /abort/i.test(msg)
}

/**
 * The full linking flow: connect a Tezos wallet (octez.connect picker),
 * have it sign the canonical attestation, and upsert the tezos entry into
 * the user's com.tzbsky.cryptoAddress/self record (preserving entries for
 * other chains). Returns the linked address.
 *
 * The SDK (and its Buffer dependency) load lazily — they're heavy and only
 * needed here, never on the critical path.
 */
export async function linkTezosWallet(
  agent: Agent,
  did: string,
  onStatus: (s: LinkStatus) => void,
): Promise<string> {
  onStatus('connecting')
  // octez.connect expects a Node Buffer global; polyfill before the SDK loads.
  if (!('Buffer' in globalThis)) {
    const { Buffer } = await import('buffer')
    ;(globalThis as Record<string, unknown>).Buffer = Buffer
  }
  const { DAppClient, NetworkType, SigningType } = await import('@tezos-x/octez.connect-sdk')

  // Fresh client per attempt so the wallet picker always appears.
  const client = new DAppClient({ name: 'Ovoid', network: { type: NetworkType.MAINNET } })
  try {
    const perms = await client.requestPermissions()
    const address = perms.address
    const publicKey = perms.publicKey
    // A tz address is a hash of the public key; verifiers can't recover the
    // key from the signature, so the record must carry it.
    if (!publicKey) throw new Error('Wallet did not provide a public key')

    onStatus('signing')
    const issuedAt = Math.floor(Date.now() / 1000)
    const message = buildAddressAttestation(did, address, issuedAt)
    const signed = await client.requestSignPayload({
      signingType: SigningType.MICHELINE,
      payload: packMichelineString(message),
    })

    onStatus('publishing')
    const entry: CryptoAddressEntry = {
      chain: 'tezos',
      address,
      publicKey,
      proof: { scheme: 'tezos-micheline', message, signature: signed.signature },
    }
    await upsertCryptoAddressRecord(agent, did, entry)
    return address
  } finally {
    try {
      await client.destroy()
    } catch {
      /* ignore cleanup errors */
    }
  }
}

/**
 * Remove the tezos entry from the user's self record. Other chains' entries
 * are preserved; if tezos was the only one the whole record is deleted — same
 * as tzbsky, which drops the record entirely once no addresses remain.
 */
export async function unlinkTezosWallet(agent: Agent, did: string): Promise<void> {
  const remaining = (await readCryptoAddresses(agent, did)).filter((a) => a.chain !== 'tezos')
  if (remaining.length === 0) {
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection: CRYPTO_ADDRESS_COLLECTION,
      rkey: 'self',
    })
    return
  }
  await putCryptoAddressRecord(agent, did, remaining)
}

/** Read the user's current address entries, or [] when no record exists. */
async function readCryptoAddresses(agent: Agent, did: string): Promise<CryptoAddressEntry[]> {
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: CRYPTO_ADDRESS_COLLECTION,
      rkey: 'self',
    })
    return (res.data.value as Partial<CryptoAddressRecord>).addresses ?? []
  } catch {
    return [] // RecordNotFound: no link yet.
  }
}

/** Read-modify-write the self record, replacing this chain's entry only. */
async function upsertCryptoAddressRecord(
  agent: Agent,
  did: string,
  entry: CryptoAddressEntry,
): Promise<void> {
  const existing = await readCryptoAddresses(agent, did)
  await putCryptoAddressRecord(agent, did, [
    ...existing.filter((a) => a.chain !== entry.chain),
    entry,
  ])
}

async function putCryptoAddressRecord(
  agent: Agent,
  did: string,
  addresses: CryptoAddressEntry[],
): Promise<void> {
  // `satisfies` (not a type annotation) so the inferred literal type keeps
  // its implicit index signature — putRecord wants { [x: string]: unknown }.
  const record = {
    $type: CRYPTO_ADDRESS_COLLECTION,
    addresses,
    updatedAt: new Date().toISOString(),
  } satisfies CryptoAddressRecord
  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: CRYPTO_ADDRESS_COLLECTION,
    rkey: 'self',
    record,
  })
}
