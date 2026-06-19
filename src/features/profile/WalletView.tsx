import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { useWalletBalance, useWalletTokens, useWalletNfts, useWalletActivity } from './use-wallet'
import { BalanceCard, TokensCard, NftsSection, ActivitySection } from './WalletParts'
import { ALL_VISIBLE, type WalletVisibility } from './use-wallet-visibility'

/**
 * Desktop wallet overview (profile "Wallet" tab). A top row pairs the balance
 * card with a scrollable fungible-tokens card; the NFT preview and recent
 * activity stack below. Mobile uses its own component, WalletViewMobile.
 *
 * `sections` gates each part per the owner's published visibility. Hidden
 * sections aren't rendered AND their query is disabled, so we don't fetch data
 * we won't show.
 */
export function WalletView({
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

  // Hide the tokens card for wallets with no fungibles (show it while loading so
  // the skeleton appears); the balance card then spans the row alone.
  const showTokens = sections.tokens && (tokens.isLoading || (tokens.data?.length ?? 0) > 0)
  const showBalance = sections.balance
  const showTop = showBalance || showTokens

  return (
    <div className="wallet">
      {showTop && (
        <div className={clsx('wallet-top', !(showBalance && showTokens) && 'wallet-top--solo')}>
          {showBalance && <BalanceCard address={address} query={balance} />}
          {showTokens && <TokensCard query={tokens} />}
        </div>
      )}
      {sections.nfts && <NftsSection query={nfts} onViewAll={viewAllNfts} />}
      {sections.activity && <ActivitySection address={address} query={activity} />}
    </div>
  )
}
