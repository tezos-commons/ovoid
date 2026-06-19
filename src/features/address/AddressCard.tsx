import { Img } from '@/components'
import { shortAddr } from '@/components/embeds/providers/objkt-data'
import type { TezosAccount } from '@/features/profile/objkt'
import { FollowAddressButton } from './FollowAddressButton'

/**
 * Identity card for the address profile — the objkt avatar, name and address.
 * The standalone counterpart to the bsky ProfileCard: it sits in the same page
 * aside (desktop) / above the tabs (mobile), but carries only objkt identity
 * (this address has no Bluesky account — linked ones redirect to /profile).
 */
export function AddressCard({
  account,
  address,
}: {
  account: TezosAccount | undefined
  address: string
}) {
  return (
    <div className="addrcard">
      {account?.avatar ? (
        <Img className="addrcard__avatar" src={account.avatar} alt="" />
      ) : (
        <span className="addrcard__avatar addrcard__avatar--empty" aria-hidden />
      )}
      <div className="addrcard__meta">
        <span className="addrcard__name">{account?.name ?? shortAddr(address)}</span>
        <span className="addrcard__addr" title={address}>
          {shortAddr(address)}
        </span>
      </div>
      <FollowAddressButton address={address} />
    </div>
  )
}
