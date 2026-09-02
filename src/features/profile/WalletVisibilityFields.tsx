import { useState } from 'react'
import { SettingsListSkeleton } from '@/components'
import { Row, Switch } from '@/features/settings/components'
import {
  useMyWalletVisibility,
  useSetWalletVisibility,
  ALL_VISIBLE,
  type WalletVisibility,
} from './use-wallet-visibility'

export const VISIBILITY_FIELDS: { key: keyof WalletVisibility; label: string; sub?: string }[] = [
  { key: 'balance', label: 'Tez balance' },
  { key: 'tokens', label: 'Fungible tokens' },
  { key: 'activity', label: 'Recent activity', sub: 'Your recent on-chain transactions.' },
  {
    key: 'nfts',
    label: 'NFT preview',
    sub: 'The owned-NFT grid on the Wallet tab. Your Created and Owned tabs stay visible regardless.',
  },
]

/**
 * The per-section wallet-visibility toggles (backend.ovoid.at public record),
 * without any surrounding section chrome — so both the settings page (wraps it
 * in a <Section>) and onboarding (its own card) can render the same controls.
 *
 * Opt-out: every section shows by default; a toggle writes the whole record. The
 * draft mirrors the pending state so the switch flips instantly, reverting if
 * the write fails.
 */
export function WalletVisibilityFields() {
  const visQ = useMyWalletVisibility()
  const setVis = useSetWalletVisibility()
  const [draft, setDraft] = useState<WalletVisibility | null>(null)

  const current = draft ?? visQ.data ?? ALL_VISIBLE

  const toggle = (key: keyof WalletVisibility) => {
    const next = { ...current, [key]: !current[key] }
    setDraft(next)
    setVis.mutate(next, { onError: () => setDraft(null) })
  }

  if (visQ.isPending) {
    return <SettingsListSkeleton count={VISIBILITY_FIELDS.length} trailing />
  }

  return (
    <>
      {VISIBILITY_FIELDS.map((f) => (
        <Row
          key={f.key}
          label={f.label}
          sub={f.sub}
          trailing={
            <Switch
              label={`Show ${f.label.toLowerCase()}`}
              checked={current[f.key]}
              onChange={() => toggle(f.key)}
            />
          }
        />
      ))}
    </>
  )
}
