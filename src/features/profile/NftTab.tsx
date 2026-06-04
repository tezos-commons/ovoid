import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Spinner, NftGridSkeleton, ErrorState, EmptyState } from '@/components'
import { BackIcon } from '@/components/Icon'
import { shortAddr } from '@/components/embeds/providers/objkt-data'
import { qk } from '@/lib/query-keys'
import { useObjktCollections, useObjktTokens, useObjktCollectionName } from './use-nfts'
import { NftGrid } from './NftGrid'
import type { NftCollection, NftKind } from './objkt'

export interface NftTabProps {
  address: string | undefined
  kind: NftKind
}

/**
 * One NFT tab (Created or Owned). Two levels on the same surface: a grid of the
 * address's collections, and — once one is picked — that collection's tokens.
 *
 * The selected collection lives in the URL (`?collection=<contract>`) so it is
 * shareable and survives refresh / back. Both queries are scoped to (address,
 * kind); the token query is disabled until a collection is in the URL, the
 * collections query while one is.
 */
export function NftTab({ address, kind }: NftTabProps) {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const contract = params.get('collection') || undefined

  const collections = useObjktCollections(address, kind, { enabled: !contract })
  const tokens = useObjktTokens(address, kind, contract, { enabled: !!contract })
  const nameQ = useObjktCollectionName(contract)

  const open = (c: NftCollection) => {
    // Seed the name cache from the card we already have, so the header is
    // instant (no fetch flash); deep links resolve it via the hook instead.
    qc.setQueryData(qk.objktCollectionName(c.contract), c.name)
    const next = new URLSearchParams(params)
    next.set('collection', c.contract)
    setParams(next, { replace: true })
  }

  const back = () => {
    const next = new URLSearchParams(params)
    next.delete('collection')
    setParams(next, { replace: true })
  }

  const noun = kind === 'created' ? 'created' : 'owned'

  // Both views share one wrapper so the tab keeps a stable min-height across the
  // collections → tokens swap (and the token query's loading flash). Without it
  // the document collapses to the spinner's height mid-drill, the browser clamps
  // the scroll up, and the sticky mobile menu un-pins (the card reappears).
  return (
    <div className="nfttab">
      {contract ? (
        <>
          <button type="button" className="nfttab__back" onClick={back}>
            <BackIcon size={18} />
            <span className="nfttab__back-name">{nameQ.data ?? shortAddr(contract)}</span>
          </button>
          <NftGrid query={tokens} emptyTitle={`No ${noun} tokens in this collection`} />
        </>
      ) : (
        <CollectionGrid
          query={collections}
          onOpen={open}
          emptyTitle={kind === 'created' ? 'No created NFTs' : 'No owned NFTs'}
          emptyMessage={
            kind === 'created'
              ? 'Collections this account minted into will appear here.'
              : 'Collections this account holds tokens from will appear here.'
          }
        />
      )}
    </div>
  )
}

interface CollectionGridProps {
  query: ReturnType<typeof useObjktCollections>
  onOpen: (c: NftCollection) => void
  emptyTitle: string
  emptyMessage?: string
}

/** Grid of collection cards (sample art + collection name). */
function CollectionGrid({ query, onOpen, emptyTitle, emptyMessage }: CollectionGridProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  const items: NftCollection[] = query.data?.pages.flat() ?? []

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, items.length])

  if (query.isLoading) return <NftGridSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (items.length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} />

  return (
    <div className="nftgrid">
      <div className="nftgrid__cells">
        {items.map((c) => (
          <button
            key={c.key}
            type="button"
            className="nftcard"
            title={c.name}
            onClick={() => onOpen(c)}
          >
            <div className="nftcard__thumb">
              {c.thumb ? (
                <img src={c.thumb} alt={c.name} loading="lazy" />
              ) : (
                <span className="nftcard__noimg">{c.name}</span>
              )}
              <span className="nftcard__count">{c.countLabel}</span>
            </div>
            <span className="nftcard__name">{c.name}</span>
          </button>
        ))}
      </div>
      <div ref={sentinel} className="proffeed__sentinel">
        {query.isFetchingNextPage && <Spinner size="sm" />}
      </div>
    </div>
  )
}
