import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components'
import { WalletIcon } from '@/components/Icon'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { linkTezosWallet, isUserAbort, type LinkStatus } from './tezos-link'

const STATUS_TEXT: Record<LinkStatus, string> = {
  connecting: 'Connecting wallet…',
  signing: 'Waiting for the signature in your wallet…',
  publishing: 'Publishing the link to your account…',
}

const POINTS = [
  'You sign a short message proving you control the address — never a transaction, and it never touches your funds.',
  'The link is published to your account so the NFTs you created and own can show on your profile.',
  'You can remove it anytime from your wallet settings.',
]

/**
 * Shown in the Created/Owned tabs of the viewer's own profile when no
 * public Tezos address is linked (without one, those tabs don't exist on
 * other profiles). Explains the requirement and offers the full linking
 * flow: octez.connect → wallet signature → com.tzbsky.cryptoAddress
 * record in their repo (see tezos-link.ts).
 *
 * On success the address is seeded straight into the lookup cache so the
 * tabs light up immediately — no waiting on tzbsky's index to catch up.
 */
export function LinkTezosSection() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const [status, setStatus] = useState<LinkStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connect = async () => {
    if (!did) return
    setError(null)
    try {
      const address = await linkTezosWallet(agent, did, setStatus)
      qc.setQueryData(qk.tezosAddress(did), address)
    } catch (err) {
      // A user cancel is not an error worth surfacing.
      if (!isUserAbort(err)) {
        setError(err instanceof Error ? err.message : 'Failed to link wallet')
      }
    } finally {
      setStatus(null)
    }
  }

  return (
    <div className="tezlink">
      <div className="tezlink__icon">
        <WalletIcon size={26} />
      </div>
      <h3 className="tezlink__title">Link a Tezos wallet</h3>
      <p className="tezlink__lead">
        Connect a Tezos wallet to show the NFTs you’ve created and own right here on your profile.
      </p>
      <ul className="tezlink__points">
        {POINTS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div className="tezlink__actions">
        <Button onClick={connect} loading={status !== null} icon={<WalletIcon size={18} />}>
          Connect wallet
        </Button>
        {status && <span className="tezlink__status">{STATUS_TEXT[status]}</span>}
      </div>
      {error && <p className="tezlink__error">{error}</p>}
    </div>
  )
}
