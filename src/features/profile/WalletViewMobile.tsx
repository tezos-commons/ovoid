import { useSearchParams } from 'react-router-dom'
import { useWalletBalance, useWalletTokens, useWalletNfts, useWalletActivity } from './use-wallet'
import { BalanceCard, TokensCard, NftsSection, ActivitySection } from './WalletParts'
import { ALL_VISIBLE, type WalletVisibility } from './use-wallet-visibility'

/**
 * Mobile wallet overview (profile "Wallet" tab). A dedicated component — not the
 * desktop view with conditionals. The balance + tokens cards stack (the desktop
 * row would be too cramped on a phone): a centered balance "hero" card on top,
 * the scrollable tokens card beneath, then the shared NFT / Activity sections.
 *
 * `sections` gates each part per the owner's published visibility (see
 * WalletView for the contract).
 */
export function WalletViewMobile({
  address,
  sections = ALL_VISIBLE,
}: {
  address: string
  sections?: WalletVisibility
}) {
  const [params, setParams] = useSearchParams()
  const balance = useWalletBalance(address, { enabled: sections.balance })
  const tokens = useWalletTokens(address, { enabled: sections.tokens })
  const nfts = useWalletNfts(address, { enabled: sections.nfts })
  const activity = useWalletActivity(address, { enabled: sections.activity })

  const viewAllNfts = () => {
    const next = new URLSearchParams(params)
    next.set('tab', 'nfts-owned')
    next.delete('collection')
    setParams(next, { replace: true })
  }

  // Hide the tokens card when the wallet holds no fungibles (keep it while
  // loading for the skeleton).
  const showTokens = sections.tokens && (tokens.isLoading || (tokens.data?.length ?? 0) > 0)
  const showTop = sections.balance || showTokens

  return (
    <div className="wallet wallet--mobile">
      {showTop && (
        <div className="wallet-top">
          {sections.balance && <BalanceCard address={address} query={balance} />}
          {showTokens && <TokensCard query={tokens} />}
        </div>
      )}
      {sections.nfts && <NftsSection query={nfts} onViewAll={viewAllNfts} />}
      {sections.activity && <ActivitySection address={address} query={activity} />}
    </div>
  )
}
