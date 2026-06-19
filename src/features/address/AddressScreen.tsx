import { Navigate, useParams } from 'react-router-dom'
import { NftGridSkeleton } from '@/components'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useAddressDid } from './use-address'
import { AddressProfile } from './AddressProfile'
import { AddressProfileMobile } from './AddressProfileMobile'
// The address profile reuses the profile layout classes (.profaside/.proftab/
// .profnav/.nfttab), which live in profile.css — load it on this route too.
import '@/features/profile/profile.css'
import './address.css'

/**
 * Standalone view for a Tezos account address (/address/:address), reached by
 * typing a tz1/tz2/tz3 address into search.
 *
 * If the address is linked to a Bluesky account (tzbsky reverse lookup), that
 * full profile is the canonical view, so we redirect to it. Otherwise we show an
 * objkt-identity mini profile (name + avatar) laid out like the regular profile,
 * with only the Created/Owned NFT tabs — no posts, no wallet. A tzbsky error
 * degrades to the mini profile rather than failing.
 */
export default function AddressScreen() {
  const { address = '' } = useParams()
  const isMobile = useIsMobile()
  const link = useAddressDid(address)

  if (link.isLoading) {
    return (
      <div className="proftab">
        <ScreenHeader title="Profile" showBack />
        <NftGridSkeleton />
      </div>
    )
  }

  if (link.data) return <Navigate to={`/profile/${link.data}`} replace />

  return isMobile ? (
    <AddressProfileMobile address={address} />
  ) : (
    <AddressProfile address={address} />
  )
}
