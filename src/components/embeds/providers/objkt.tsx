import type { ExternalEmbedMatcher } from '../external-registry'
import type { ExternalEmbedProps } from '../GenericExternalCard'
import { GenericExternalCard } from '../GenericExternalCard'
import { TokenEmbed } from './TokenEmbed'

// https://objkt.com/tokens/<fa_contract>/<token_id>
const PATH = /^\/tokens\/(KT1[0-9A-Za-z]+)\/(\d+)/

function ObjktEmbed({ external }: ExternalEmbedProps) {
  const m = new URL(external.uri).pathname.match(PATH)
  if (!m) return <GenericExternalCard external={external} />
  return <TokenEmbed external={external} fa={m[1]} tokenId={m[2]} source="objkt" />
}

export const objktMatcher: ExternalEmbedMatcher = {
  id: 'objkt',
  test: (url) => /(^|\.)objkt\.com$/.test(url.hostname) && PATH.test(url.pathname),
  Component: ObjktEmbed,
}
