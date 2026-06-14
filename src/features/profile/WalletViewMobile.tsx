import { useSearchParams } from 'react-router-dom'
import { useWalletBalance, useWalletTokens, useWalletNfts, useWalletActivity } from './use-wallet'
import { BalanceCard, TokensCard, NftsSection, ActivitySection } from './WalletParts'

/**
 * Mobile wallet overview (profile "Wallet" tab). A dedicated component — not the
 * desktop view with conditionals. The balance + tokens cards stack (the desktop
 * row would be too cramped on a phone): a centered balance "hero" card on top,
 * the scrollable tokens card beneath, then the shared NFT / Activity sections.
 */
export function WalletViewMobile({ address }: { address: string }) {
  const [params, setParams] = useSearchParams()
  const balance = useWalletBalance(address)
  const tokens = useWalletTokens(address)
  const nfts = useWalletNfts(address)
  const activity = useWalletActivity(address)

  const viewAllNfts = () => {
    const next = new URLSearchParams(params)
    next.set('tab', 'nfts-owned')
    next.delete('collection')
    setParams(next, { replace: true })
  }

  // Hide the tokens card when the wallet holds no fungibles (keep it while
  // loading for the skeleton).
  const showTokens = tokens.isLoading || (tokens.data?.length ?? 0) > 0

  return (
    <div className="wallet wallet--mobile">
      <div className="wallet-top">
        <BalanceCard address={address} query={balance} />
        {showTokens && <TokensCard query={tokens} />}
      </div>
      <NftsSection query={nfts} onViewAll={viewAllNfts} />
      <ActivitySection address={address} query={activity} />
    </div>
  )
}
