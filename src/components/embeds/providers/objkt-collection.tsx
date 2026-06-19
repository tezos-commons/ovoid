import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { ExternalEmbedMatcher } from '../external-registry'
import type { ExternalEmbedProps } from '../GenericExternalCard'
import { GenericExternalCard } from '../GenericExternalCard'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import {
  contractInfoOptions,
  useCollectionMeta,
  useCollectionTokens,
} from '@/features/contract/use-contract'
import './objkt-collection.css'

// https://objkt.com/collections/<KT1…> — the whole-collection page.
const COLLECTION_PATH = /^\/collections\/(KT1[0-9A-Za-z]+)/
const PREVIEW = 6 // 2 rows × 3

const stop = (e: MouseEvent) => e.stopPropagation()

/**
 * Rich embed for an objkt collection link: the collection title + a small grid of
 * its first tokens. Reuses the /contract view's exact queries (useCollectionMeta
 * /useCollectionTokens), so rendering the embed warms that page — clicking the
 * card opens it from cache. Shared registry, so it renders in both the feed and
 * chat.
 */
function CollectionEmbed({ external }: ExternalEmbedProps) {
  const contract = new URL(external.uri).pathname.match(COLLECTION_PATH)?.[1]
  if (!contract) return <GenericExternalCard external={external} />
  return <CollectionCard external={external} contract={contract} />
}

function CollectionCard({ external, contract }: ExternalEmbedProps & { contract: string }) {
  const meta = useCollectionMeta(contract)
  const tokens = useCollectionTokens(contract)

  // Rendering already warms the collection meta + tokens (the same queries the
  // /contract view reads). Warm its remaining gate — the TzKT classification —
  // on visibility, so clicking the card opens that page fully from cache.
  const prefetchRef = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const opts = contractInfoOptions(contract)
    schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
  })

  const items = (tokens.data?.pages[0] ?? []).slice(0, PREVIEW)

  // Settled with no tokens — not a renderable collection; fall back to the plain
  // link card rather than an empty grid.
  if (!tokens.isLoading && items.length === 0) {
    return <GenericExternalCard external={external} />
  }

  // `||` not `??`: chat passes an empty-string title, which should still fall
  // through to the collection name / placeholder.
  const title = meta.data?.name || external.title || 'Collection'

  return (
    <Link
      ref={prefetchRef}
      className="embed embed--collection"
      to={`/contract/${contract}`}
      onClick={stop}
    >
      <div className="coll-embed__head">
        {meta.data?.logo && (
          <img className="coll-embed__logo" src={meta.data.logo} alt="" loading="lazy" />
        )}
        <span className="coll-embed__title">{title}</span>
        <span className="coll-embed__src">objkt</span>
      </div>
      <div className="coll-embed__grid">
        {tokens.isLoading
          ? Array.from({ length: PREVIEW }).map((_, i) => (
              <div key={i} className="coll-embed__cell coll-embed__cell--ph" />
            ))
          : items.map((t) => (
              <div key={t.key} className="coll-embed__cell" title={t.name}>
                {t.thumb ? (
                  <img src={t.thumb} alt={t.name} loading="lazy" />
                ) : (
                  <span className="coll-embed__noimg">{t.name}</span>
                )}
              </div>
            ))}
      </div>
    </Link>
  )
}

export const objktCollectionMatcher: ExternalEmbedMatcher = {
  id: 'objkt-collection',
  test: (url) => /(^|\.)objkt\.com$/.test(url.hostname) && COLLECTION_PATH.test(url.pathname),
  Component: CollectionEmbed,
}
