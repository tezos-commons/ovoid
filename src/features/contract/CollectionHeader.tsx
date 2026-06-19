import { Img } from '@/components'
import { shortAddr } from '@/components/embeds/providers/objkt-data'
import type { CollectionMeta } from '@/features/profile/objkt'

/**
 * Shared collection hero — logo, name, description, creator — used by both the
 * desktop and mobile collection views. Layout differences live in CSS, keyed off
 * the parent `.collection--desktop` / `.collection--mobile` wrapper.
 */
export function CollectionHeader({ meta }: { meta: CollectionMeta }) {
  const { creator } = meta
  return (
    <header className="collection-head">
      {meta.logo && (
        <Img className="collection-head__logo" src={meta.logo} alt="" />
      )}
      <div className="collection-head__text">
        <h1 className="collection-head__name">{meta.name}</h1>
        {creator && (
          <div className="collection-head__creator">
            {creator.avatar && (
              <Img className="collection-head__creator-avatar" src={creator.avatar} alt="" />
            )}
            <span className="collection-head__creator-name">{creator.name}</span>
            <span className="collection-head__creator-addr" title={creator.address}>
              {shortAddr(creator.address)}
            </span>
          </div>
        )}
        {meta.description && <p className="collection-head__desc">{meta.description}</p>}
      </div>
    </header>
  )
}
