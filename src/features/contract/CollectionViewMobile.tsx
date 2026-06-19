import { useMobileTitle } from '@/components/layout'
import { NftGrid } from '@/features/profile/NftGrid'
import { CollectionHeader } from './CollectionHeader'
import { useCollectionMeta, useCollectionTokens } from './use-contract'

/**
 * Mobile collection view. A dedicated component (not the desktop view with
 * conditionals): the hero stacks above a full-bleed token grid, sized for a
 * phone. On mobile the route's ScreenHeader is hidden, so the collection name
 * goes into the floating top bar via useMobileTitle (which also gets an
 * automatic back button on this non-root route).
 */
export function CollectionViewMobile({ contract }: { contract: string }) {
  const meta = useCollectionMeta(contract)
  const tokens = useCollectionTokens(contract)

  useMobileTitle(meta.data?.name ?? 'Collection')

  return (
    <div className="collection collection--mobile">
      {meta.data && <CollectionHeader meta={meta.data} />}
      <NftGrid query={tokens} emptyTitle="No tokens in this collection" />
    </div>
  )
}
