import type { ExternalEmbedMatcher } from '../external-registry'
import type { ExternalEmbedProps } from '../GenericExternalCard'
import { GenericExternalCard } from '../GenericExternalCard'
import { TokenEmbed } from './TokenEmbed'
import { useObjktCollectionContract } from './objkt-data'

// Two URL shapes for the same token page:
//   https://objkt.com/tokens/<fa_contract>/<token_id>   (contract address)
//   https://objkt.com/tokens/<collection-slug>/<token_id>  (fa.path, e.g. "hicetnunc")
const ADDR_PATH = /^\/tokens\/(KT1[0-9A-Za-z]+)\/(\d+)/
const SLUG_PATH = /^\/tokens\/([A-Za-z0-9_-]+)\/(\d+)/

function ObjktEmbed({ external }: ExternalEmbedProps) {
  const pathname = new URL(external.uri).pathname
  const addr = pathname.match(ADDR_PATH)
  const slug = addr ? null : pathname.match(SLUG_PATH)
  const resolved = useObjktCollectionContract(slug?.[1])

  const fa = addr?.[1] ?? resolved.data ?? undefined
  const tokenId = (addr ?? slug)?.[2]

  if (fa && tokenId) return <TokenEmbed external={external} fa={fa} tokenId={tokenId} source="objkt" />
  // Slug still resolving — render nothing rather than flashing the plain card.
  if (slug && resolved.isLoading) return null
  // Unresolvable (unknown slug, non-token path): plain link card.
  return <GenericExternalCard external={external} />
}

export const objktMatcher: ExternalEmbedMatcher = {
  id: 'objkt',
  test: (url) => /(^|\.)objkt\.com$/.test(url.hostname) && SLUG_PATH.test(url.pathname),
  Component: ObjktEmbed,
}
