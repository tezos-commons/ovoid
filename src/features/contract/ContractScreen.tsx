import { useParams } from 'react-router-dom'
import { EmptyState, ErrorState, NftGridSkeleton } from '@/components'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { usePageFullWidth } from '@/components/layout/PageLayout'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useContractInfo } from './use-contract'
import { CollectionView } from './CollectionView'
import { CollectionViewMobile } from './CollectionViewMobile'
import './contract.css'

/**
 * Standalone view for a Tezos contract address (/contract/:contract), reached by
 * typing a KT1 address into search. This is the dispatcher: it classifies the
 * contract via TzKT and renders the matching view. Today only token collections
 * have one; other kinds fall through to a placeholder, leaving room to add more
 * contract types behind the same route later.
 *
 * The whole route is full-width (overrides the aside + rail) so collection grids
 * use the entire page area on desktop.
 */
export default function ContractScreen() {
  const { contract = '' } = useParams()
  const isMobile = useIsMobile()
  // Full-width is a desktop concern (override the 3 columns); on mobile the page
  // is already full-bleed and .page--full would drop the floating-bar padding.
  usePageFullWidth(!isMobile)
  const info = useContractInfo(contract)

  if (info.isLoading) {
    return (
      <div className="collection">
        <ScreenHeader title="Collection" showBack />
        <NftGridSkeleton />
      </div>
    )
  }

  if (info.isError) {
    return (
      <>
        <ScreenHeader title="Contract" showBack />
        <ErrorState
          error={info.error}
          onRetry={() => info.refetch()}
          title="Contract unavailable"
        />
      </>
    )
  }

  if (info.data?.kind === 'nft-collection') {
    return isMobile ? (
      <CollectionViewMobile contract={contract} />
    ) : (
      <CollectionView contract={contract} />
    )
  }

  // Not a contract, or a kind we don't render yet.
  return (
    <>
      <ScreenHeader title="Contract" showBack />
      <EmptyState
        title="Nothing to show here"
        message={
          info.data
            ? "This contract isn't a token collection we can display yet."
            : "This doesn't look like a Tezos contract."
        }
      />
    </>
  )
}
