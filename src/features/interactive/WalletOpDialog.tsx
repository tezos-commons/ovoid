import { useEffect, useState } from 'react'
import { ModalSheet } from '@/components'
import {
  connectWallet,
  getActiveWallet,
  requestOperation,
  switchWallet,
} from '@/lib/tezos/wallet-session'
import { isUserAbort } from '@/features/profile/tezos-link'
import { useWalletOpStore } from './wallet-op-store'
import './interactive.css'

type Phase = 'checking' | 'connect' | 'mismatch' | 'confirm' | 'signing' | 'error'

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

/** mutez → ꜩ display (1 ꜩ = 1e6 mutez). */
function tez(amount: unknown): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n) || n === 0) return '0'
  return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function OpRow({ op }: { op: Record<string, unknown> }) {
  const params = op.parameters as { entrypoint?: string; value?: unknown } | undefined
  const amount = tez(op.amount)
  return (
    <div className="walletop__op">
      <div className="walletop__op-row">
        <span className="walletop__op-kind">{String(op.kind)}</span>
        {op.destination !== undefined && (
          <code className="walletop__op-to">{short(String(op.destination))}</code>
        )}
      </div>
      {params?.entrypoint && (
        <div className="walletop__op-line">
          call <strong>{params.entrypoint}</strong>
        </div>
      )}
      <div className={'walletop__op-line' + (amount !== '0' ? ' walletop__op-amount' : '')}>
        {amount !== '0' ? `sends ${amount} ꜩ` : 'no ꜩ transferred'}
      </div>
      {params?.value !== undefined && (
        <details className="walletop__params">
          <summary>parameters</summary>
          <pre>{JSON.stringify(params.value, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}

/**
 * Interactive-artifact wallet-operation prompt. Enforces the core invariant:
 * an operation may only run against the user's LINKED wallet (the tz address
 * ovoid hands to apps). If no wallet is connected we ask them to connect that
 * specific address; if a different wallet is connected we block and offer to
 * switch. Only when the active wallet matches the linked address do we show the
 * operation and forward it — and the wallet's own confirmation is still the
 * final gate.
 */
export function WalletOpDialog() {
  const current = useWalletOpStore((s) => s.current)
  const settle = useWalletOpStore((s) => s.settle)
  const [phase, setPhase] = useState<Phase>('checking')
  const [connected, setConnected] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const [recheck, setRecheck] = useState(0)
  const linked = current?.linkedAddress ?? ''

  // On open (and on retry), read the active wallet and classify:
  // matches / mismatch / none.
  useEffect(() => {
    if (!current) return
    let cancelled = false
    setPhase('checking')
    setErr('')
    getActiveWallet()
      .then((acc) => {
        if (cancelled) return
        if (!acc) {
          setConnected(null)
          setPhase('connect')
        } else if (acc.address !== linked) {
          setConnected(acc.address)
          setPhase('mismatch')
        } else {
          setConnected(acc.address)
          setPhase('confirm')
        }
      })
      .catch(() => !cancelled && setPhase('connect'))
    return () => {
      cancelled = true
    }
  }, [current, linked, recheck])

  if (!current) return null

  const deny = () => settle({ ok: false, error: 'denied' })

  const doConnect = async (force: boolean) => {
    setErr('')
    try {
      const acc = force ? await switchWallet() : await connectWallet()
      if (acc.address !== linked) {
        setConnected(acc.address)
        setPhase('mismatch')
      } else {
        setConnected(acc.address)
        setPhase('confirm')
      }
    } catch (e) {
      if (isUserAbort(e)) return // user closed the picker; stay on this step
      setErr(e instanceof Error ? e.message : 'connection failed')
      setPhase('error')
    }
  }

  const confirm = async () => {
    setPhase('signing')
    setErr('')
    try {
      const opHash = await requestOperation(current.ops)
      settle({ ok: true, opHash })
    } catch (e) {
      if (isUserAbort(e)) {
        settle({ ok: false, error: 'denied' })
        return
      }
      setErr(e instanceof Error ? e.message : 'operation failed')
      setPhase('error')
    }
  }

  const heading =
    phase === 'confirm' || phase === 'signing' ? 'Confirm wallet action' : 'Connect your wallet'

  return (
    <ModalSheet open onClose={deny} title={heading}>
      <div className="walletop">
        {current.title && <div className="iconsent__name">{current.title}</div>}
        <code className="iconsent__origin">{new URL(current.origin).hostname}</code>

        {phase === 'checking' && <p className="muted">checking your wallet…</p>}

        {phase === 'connect' && (
          <>
            <p>
              This experience wants to send an operation to your wallet. Connect{' '}
              <strong>this specific wallet</strong> — the one linked to your account:
            </p>
            <code className="walletop__addr">{linked}</code>
            <div className="iconsent__actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={deny}>
                Deny
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => doConnect(false)}>
                Connect wallet
              </button>
            </div>
          </>
        )}

        {phase === 'mismatch' && (
          <>
            <p className="walletop__warn">
              The connected wallet doesn’t match your linked address. Operations can only run
              against your linked wallet.
            </p>
            <div className="walletop__pair">
              <span>connected</span>
              <code>{short(connected ?? '')}</code>
            </div>
            <div className="walletop__pair">
              <span>linked</span>
              <code className="walletop__addr">{linked}</code>
            </div>
            <div className="iconsent__actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={deny}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => doConnect(true)}>
                Switch wallet
              </button>
            </div>
          </>
        )}

        {(phase === 'confirm' || phase === 'signing') && (
          <>
            <p>This experience wants to send the following to your wallet:</p>
            <div className="walletop__ops">
              {current.ops.map((op, i) => (
                <OpRow key={i} op={op} />
              ))}
            </div>
            <div className="walletop__pair">
              <span>from</span>
              <code>{short(linked)}</code>
            </div>
            <p className="muted walletop__note">
              Your wallet will ask you to confirm and sign — that’s the final step.
            </p>
            <div className="iconsent__actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={deny}
                disabled={phase === 'signing'}
              >
                Deny
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={confirm}
                disabled={phase === 'signing'}
              >
                {phase === 'signing' ? 'waiting for wallet…' : 'Confirm'}
              </button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="err walletop__warn">{err || 'Something went wrong.'}</p>
            <div className="iconsent__actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={deny}>
                Close
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setRecheck((n) => n + 1)}
              >
                Retry
              </button>
            </div>
          </>
        )}
      </div>
    </ModalSheet>
  )
}
