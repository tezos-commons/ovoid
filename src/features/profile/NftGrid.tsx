import { useEffect, useRef } from 'react'
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { Spinner, NftGridSkeleton, ErrorState, EmptyState } from '@/components'
import { useNftBrowserStore } from '@/store/nft-browser-store'
import type { NftToken } from './objkt'
import './nft-grid.css'

export interface NftGridProps {
  /** Any infinite query of token pages — the profile tabs or the /contract view. */
  query: UseInfiniteQueryResult<InfiniteData<NftToken[]>, Error>
  emptyTitle: string
  emptyMessage?: string
}

/**
 * Grid of objkt tokens (the profile "Created" / "Owned" NFT tabs). Same
 * IntersectionObserver infinite-scroll contract as ProfileFeed; each cell links
 * out to the token's objkt.com page in a new tab.
 */
export function NftGrid({ query, emptyTitle, emptyMessage }: NftGridProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  const openNft = useNftBrowserStore((s) => s.openNft)
  const items: NftToken[] = query.data?.pages.flat() ?? []
  // Snapshot of the loaded tokens, handed to the browser so it can step
  // prev/next through this collection. Recomputed each render, so a click
  // captures everything loaded so far (the grid is infinite-scroll, so every
  // rendered cell is loaded).
  const refs = items.map((t) => ({ fa: t.fa, tokenId: t.tokenId }))

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
        {items.map((t) => (
          <button
            key={t.key}
            type="button"
            className="nftcard"
            title={t.name}
            // Open the shared fullscreen NFT browser (artwork + description,
            // listings, history, artist gallery) for this token.
            onClick={() => openNft(t.fa, t.tokenId, refs)}
          >
            <div className="nftcard__thumb">
              {t.thumb ? (
                <img src={t.thumb} alt={t.name} loading="lazy" />
              ) : (
                <span className="nftcard__noimg">{t.name}</span>
              )}
            </div>
            <span className="nftcard__name">{t.name}</span>
          </button>
        ))}
      </div>
      <div ref={sentinel} className="nftgrid__sentinel">
        {query.isFetchingNextPage && <Spinner size="sm" />}
      </div>
    </div>
  )
}
