import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth, useAgent } from '@/lib/api/agent'
import { Button, Spinner } from '@/components'
import { qk } from '@/lib/query-keys'
import { linkTezosWallet, isUserAbort, type LinkStatus } from '@/features/profile/tezos-link'
import { WalletVisibilityFields } from '@/features/profile/WalletVisibilityFields'
import { useOvoidAccess } from './use-ovoid-access'
import './auth.css'

const STATUS_TEXT: Record<LinkStatus, string> = {
  connecting: 'Connecting wallet…',
  signing: 'Waiting for the signature in your wallet…',
  publishing: 'Publishing the link to your account…',
}

/**
 * Wallet-connect onboarding for users who signed in but don't yet have access
 * (not on the beta list, no linked wallet). Two steps:
 *
 *   1. Explain why Ovoid needs a linked Tezos address + Connect wallet (reuses
 *      the same linkTezosWallet flow as Settings → Linked Wallet). On success we
 *      patch qk.tezosAddress so the access gate flips immediately rather than
 *      waiting on tzbsky's index to catch up.
 *   2. Let them choose what wallet sections to show publicly (the same controls
 *      as settings), then enter the app.
 *
 * Reached only via the access gate (RequireAccess → /onboarding). A user who
 * already has access is bounced home, except once they've just connected here
 * and advanced to the visibility step.
 */
export default function Onboarding() {
  const auth = useAuth()
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const access = useOvoidAccess()

  const [step, setStep] = useState<'connect' | 'visibility'>('connect')
  const [status, setStatus] = useState<LinkStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Don't flash anything while the session — or the access check — resolves.
  if (auth.isLoading || (access.isLoading && step === 'connect')) {
    return (
      <div className="auth-callback">
        <Spinner size="lg" />
      </div>
    )
  }

  // Already has access (list member, or a wallet linked elsewhere) → straight in.
  // Suppressed on the visibility step: there we DO have access (just connected)
  // but want the user to finish choosing their profile visibility first.
  if (access.hasAccess && step === 'connect') {
    return <Navigate to="/" replace />
  }

  const connect = async () => {
    if (!did) return
    setError(null)
    try {
      const linked = await linkTezosWallet(agent, did, setStatus)
      // Flip the gate instantly — tzbsky's index lags the record write.
      qc.setQueryData(qk.tezosAddress(did), linked)
      setStep('visibility')
    } catch (err) {
      if (!isUserAbort(err)) {
        setError(err instanceof Error ? err.message : 'Failed to connect wallet')
      }
    } finally {
      setStatus(null)
    }
  }

  return (
    <div className="auth-screen">
      <main className="auth-screen__main">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand__logo" aria-hidden="true">
              <img src="/icon-512.png" alt="" width={64} height={64} />
            </div>
            <h1 className="auth-brand__title">
              {step === 'connect' ? 'Connect your Tezos wallet' : 'Your wallet on your profile'}
            </h1>
            <p className="auth-brand__tagline">
              {step === 'connect'
                ? 'One step left to enter Ovoid.'
                : 'Choose what other people see. You can change this any time.'}
            </p>
          </div>

          {step === 'connect' ? (
            <>
              <div className="onb-explainer">
                <p>
                  Ovoid is for the Tezos community, so it links your Bluesky profile to a public
                  Tezos address. The link is a short message signed by your wallet and published to
                  your account — it <strong>never touches your funds</strong>.
                </p>
                <p>
                  Because it lives in your atproto repo, the connection is public: other apps can
                  read which Tezos address belongs to your profile, and Ovoid uses it to show the
                  NFTs you’ve created and own.
                </p>
              </div>

              {error && (
                <div className="auth-error" role="alert">
                  <span aria-hidden="true">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                className="auth-form__submit"
                loading={status !== null}
                onClick={connect}
              >
                Connect wallet
              </Button>
              {status && <p className="auth-note">{STATUS_TEXT[status]}</p>}
            </>
          ) : (
            <>
              <p className="onb-explainer">
                Everything is shown by default. Hide anything you’d rather keep off your profile —
                the wallet data stays public on-chain regardless; this only controls what Ovoid
                displays.
              </p>
              <div className="onb-vis">
                <WalletVisibilityFields />
              </div>
              <Button
                variant="primary"
                size="lg"
                className="auth-form__submit"
                onClick={() => navigate('/', { replace: true })}
              >
                Enter Ovoid
              </Button>
              <p className="auth-note">
                You can change these any time in Settings → Linked Wallet.
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="auth-footer">
        <a href="https://bsky.social/about/support/privacy-policy" target="_blank" rel="noreferrer">
          Privacy
        </a>
        <a href="https://bsky.social/about/support/tos" target="_blank" rel="noreferrer">
          Terms
        </a>
      </footer>
    </div>
  )
}
