import { PageAside, useHidePageRail } from '@/components/layout'
import { ProfileNav } from '@/features/profile/ProfileNav'
import { NftTab } from '@/features/profile/NftTab'
import { AddressCard } from './AddressCard'
import { useTezosAccount, useAddressTab, ADDRESS_TABS } from './use-address'

/**
 * Desktop address profile. Mirrors the regular profile layout — identity card +
 * section nav in the left aside, content in the main column — but with only the
 * Created/Owned NFT tabs (no posts, no wallet). The right rail is hidden, the way
 * the profile's wide Tezos tabs do, so the grid widens into its space.
 */
export function AddressProfile({ address }: { address: string }) {
  const account = useTezosAccount(address)
  const { tab, setTab } = useAddressTab(address)
  useHidePageRail(true)

  return (
    <>
      <PageAside>
        <div className="profaside">
          <AddressCard account={account.data} address={address} />
          <ProfileNav items={ADDRESS_TABS} activeKey={tab} onChange={setTab} />
        </div>
      </PageAside>
      <div className="proftab">
        <NftTab address={address} kind={tab} />
      </div>
    </>
  )
}
