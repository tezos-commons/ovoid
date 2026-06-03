import type { ExternalEmbedMatcher } from '../external-registry'
import type { ExternalEmbedProps } from '../GenericExternalCard'
import { GenericExternalCard } from '../GenericExternalCard'
import { TokenEmbed } from './TokenEmbed'

// Teia mints live on the Teia Community / hic et nunc contract; teia.art links
// look like https://teia.art/objkt/<token_id>.
const TEIA_FA = 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton'
const PATH = /^\/objkt\/(\d+)/

function TeiaEmbed({ external }: ExternalEmbedProps) {
  const m = new URL(external.uri).pathname.match(PATH)
  if (!m) return <GenericExternalCard external={external} />
  return <TokenEmbed external={external} fa={TEIA_FA} tokenId={m[1]} source="teia" />
}

export const teiaMatcher: ExternalEmbedMatcher = {
  id: 'teia',
  test: (url) => /(^|\.)teia\.art$/.test(url.hostname) && PATH.test(url.pathname),
  Component: TeiaEmbed,
}
