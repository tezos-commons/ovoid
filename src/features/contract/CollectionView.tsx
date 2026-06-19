import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { NftGrid } from '@/features/profile/NftGrid'
import { CollectionHeader } from './CollectionHeader'
import { useCollectionMeta, useCollectionTokens } from './use-contract'

/**
 * Desktop collection view. The /contract route runs full-width (ContractScreen
 * calls usePageFullWidth), so this spans the whole page area — no reserved aside
 * or rail — and the token grid fills it edge to edge.
 */
export function CollectionView({ contract }: { contract: string }) {
  const meta = useCollectionMeta(contract)
  const tokens = useCollectionTokens(contract)

  return (
    <div className="collection collection--desktop">
      <ScreenHeader title={meta.data?.name ?? 'Collection'} showBack />
      {meta.data && <CollectionHeader meta={meta.data} />}
      <NftGrid query={tokens} emptyTitle="No tokens in this collection" />
    </div>
  )
}
