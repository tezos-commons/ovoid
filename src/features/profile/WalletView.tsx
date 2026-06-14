import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { useWalletBalance, useWalletTokens, useWalletNfts, useWalletActivity } from './use-wallet'
import { BalanceCard, TokensCard, NftsSection, ActivitySection } from './WalletParts'

/**
 * Desktop wallet overview (profile "Wallet" tab). A top row pairs the balance
 * card with a scrollable fungible-tokens card; the NFT preview and recent
 * activity stack below. Mobile uses its own component, WalletViewMobile.
 */
export function WalletView({ address }: { address: string }) {
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

  // Hide the tokens card for wallets with no fungibles (show it while loading so
  // the skeleton appears); the balance card then spans the row alone.
  const showTokens = tokens.isLoading || (tokens.data?.length ?? 0) > 0

  return (
    <div className="wallet">
      <div className={clsx('wallet-top', !showTokens && 'wallet-top--solo')}>
        <BalanceCard address={address} query={balance} />
        {showTokens && <TokensCard query={tokens} />}
      </div>
      <NftsSection query={nfts} onViewAll={viewAllNfts} />
      <ActivitySection address={address} query={activity} />
    </div>
  )
}
