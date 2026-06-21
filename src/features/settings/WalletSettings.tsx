import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Button, SettingsListSkeleton } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { useTezosAddress } from '@/features/profile/use-nfts'
import { linkTezosWallet, unlinkTezosWallet, isUserAbort, type LinkStatus } from '@/features/profile/tezos-link'
import { WalletVisibilityFields } from '@/features/profile/WalletVisibilityFields'
import { Section } from './components'

const STATUS_TEXT: Record<LinkStatus, string> = {
  connecting: 'Connecting wallet…',
  signing: 'Waiting for the signature in your wallet…',
  publishing: 'Publishing the link to your account…',
}

/**
 * Linked-wallet settings. Reads the viewer's published Tezos address (the same
 * lookup the profile NFT tabs use) and lets them link one or remove the link.
 *
 * Both mutations write the com.tzbsky.cryptoAddress/self record on the user's
 * PDS directly (see tezos-link.ts) and then patch qk.tezosAddress in-place, so
 * the change is reflected instantly here and on the profile without waiting on
 * tzbsky's index to catch up.
 */
export default function WalletSettings() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const addressQ = useTezosAddress(did)
  const address = addressQ.data ?? undefined

  const [status, setStatus] = useState<LinkStatus | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const link = async () => {
    if (!did) return
    setError(null)
    try {
      const linked = await linkTezosWallet(agent, did, setStatus)
      qc.setQueryData(qk.tezosAddress(did), linked)
    } catch (err) {
      // A user cancel is not an error worth surfacing.
      if (!isUserAbort(err)) {
        setError(err instanceof Error ? err.message : 'Failed to link wallet')
      }
    } finally {
      setStatus(null)
    }
  }

  const unlink = async () => {
    if (!did) return
    setError(null)
    setRemoving(true)
    try {
      await unlinkTezosWallet(agent, did)
      qc.setQueryData(qk.tezosAddress(did), null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove the link')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <ScreenHeader title="Linked Wallet" showBack />
      <div className="settings">
        <Section
          title="Tezos wallet"
          desc="Link a public Tezos address to your account to show the NFTs you've created and own on your profile. The link is a short message signed by your wallet and published to your repo — it never touches your funds."
        >
          {addressQ.isPending ? (
            <SettingsListSkeleton count={1} trailing />
          ) : address ? (
            <div className="settings-pad">
              <div className="settings-kv">
                <span className="settings-kv__k">Linked address</span>
                {/* Short form for display; Copy still copies the full address. */}
                <span className="settings-kv__v" title={address}>
                  {`${address.slice(0, 6)}…${address.slice(-5)}`}
                </span>
              </div>
              <div className="settings-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigator.clipboard?.writeText(address)}
                >
                  Copy
                </Button>
                <Button variant="danger" size="sm" loading={removing} onClick={unlink}>
                  Remove link
                </Button>
              </div>
            </div>
          ) : (
            <div className="settings-pad">
              <div className="settings-actions">
                <Button onClick={link} loading={status !== null}>
                  Connect wallet
                </Button>
                {status && <span className="settings-note settings-note--inline">{STATUS_TEXT[status]}</span>}
              </div>
            </div>
          )}

          {error && (
            <p className="settings-note" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}
        </Section>

        {/* Visibility only matters once there's a wallet to show. */}
        {address && <WalletVisibilitySection />}
      </div>
    </>
  )
}

/**
 * Per-section wallet visibility (data.ovoid.at public record). The controls
 * themselves are shared with onboarding via WalletVisibilityFields; this just
 * wraps them in the settings section chrome.
 */
function WalletVisibilitySection() {
  return (
    <Section
      title="Profile visibility"
      desc="Choose which parts of your wallet other people can see on your profile. Everything is shown by default. (The wallet data is public on-chain regardless — this only controls what the app displays.)"
    >
      <WalletVisibilityFields />
    </Section>
  )
}
