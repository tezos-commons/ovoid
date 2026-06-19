import { MobileTopRight, MobileSelect, useMobileTitle } from '@/components/layout'
import { PencilIcon, BookmarkIcon } from '@/components/Icon'
import { shortAddr } from '@/components/embeds/providers/objkt-data'
import { NftTab } from '@/features/profile/NftTab'
import type { NftKind } from '@/features/profile/objkt'
import { AddressCard } from './AddressCard'
import { useTezosAccount, useAddressTab } from './use-address'

const TAB_LABEL: Record<NftKind, string> = { created: 'Created', owned: 'Owned' }
const TAB_ICON: Record<NftKind, React.ReactNode> = {
  created: <PencilIcon size={22} />,
  owned: <BookmarkIcon size={22} />,
}

/**
 * Mobile address profile. Matches the regular profile on phones: the section
 * switch is a dropdown in the top bar (MobileSelect via MobileTopRight), not an
 * inline strip; the identity card heads the content. The name goes into the top
 * bar via useMobileTitle, which also supplies the back button on this non-root
 * route.
 */
export function AddressProfileMobile({ address }: { address: string }) {
  const account = useTezosAccount(address)
  const { tab, setTab } = useAddressTab(address)
  useMobileTitle(account.data?.name ?? shortAddr(address))

  return (
    <>
      <MobileTopRight>
        <MobileSelect
          ariaLabel="Profile section"
          grid
          label={TAB_LABEL[tab]}
          items={(['created', 'owned'] as const).map((k) => ({
            key: k,
            label: TAB_LABEL[k],
            icon: TAB_ICON[k],
            active: k === tab,
            onSelect: () => setTab(k),
          }))}
        />
      </MobileTopRight>
      <div className="addr-mobile-head">
        <AddressCard account={account.data} address={address} />
      </div>
      <div className="proftab">
        <NftTab address={address} kind={tab} />
      </div>
    </>
  )
}
