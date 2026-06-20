import { useState, type ReactNode } from 'react'
import { Img, Skeleton, ErrorState, EmptyState } from '@/components'
import { WalletIcon } from '@/components/Icon'
import { shortAddr } from '@/components/embeds/providers/objkt-data'
import { useNftBrowserStore } from '@/store/nft-browser-store'
import { relativeTime } from '@/lib/time'
import { haptic } from '@/lib/haptics'
import { formatTez } from './tzkt'
import type {
  useWalletBalance,
  useWalletTokens,
  useWalletNfts,
  useWalletActivity,
} from './use-wallet'
import './wallet.css'

/* ----------------------------------------------------------- section wrapper */

export function WalletSection({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="wallet-section">
      <header className="wallet-section__head">
        <h3 className="wallet-section__title">
          {title}
          {count != null && <span className="wallet-section__count">{count}</span>}
        </h3>
        {action}
      </header>
      {children}
    </section>
  )
}

/* --------------------------------------------------------------- copy address */

/** tz-address chip with a one-tap copy button (transient "Copied", light haptic). */
export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      haptic('light')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked; no-op */
    }
  }
  return (
    <button type="button" className="wallet-addr" onClick={copy} title={address} aria-label="Copy address">
      <span className="wallet-addr__text">{shortAddr(address)}</span>
      <span className="wallet-addr__icon" aria-hidden="true">
        {copied ? <CheckGlyph /> : <CopyGlyph />}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------ balance amount */

export function BalanceAmount({ mutez }: { mutez: number }) {
  return (
    <span className="wallet-balance__amount">
      {formatTez(mutez)}
      <span className="wallet-balance__unit">
        {' '}
        <TezSign />
      </span>
    </span>
  )
}

/**
 * Tez (ꜩ) currency mark as inline SVG. The unicode glyph U+A729 sits in Inter's
 * latin-ext subset, which iOS Firefox often fails to load → it renders as tofu.
 * An SVG draws identically everywhere and inherits text colour and size (em).
 */
export function TezSign({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1169.87 1593"
      width="0.66em"
      height="0.9em"
      fill="currentColor"
      role="img"
      aria-label="tez"
      /* inline-block overrides the global `svg { display: block }` reset, which
         would otherwise drop the mark onto its own line after the amount. */
      style={{ display: 'inline-block', verticalAlign: '-0.05em' }}
    >
      <path d="M755.68,1593q-170.51,0-248.91-82.14a253.6,253.6,0,0,1-78.15-177,117.39,117.39,0,0,1,13.69-58.5A101.21,101.21,0,0,1,479.64,1238a130.22,130.22,0,0,1,116.24,0A99.55,99.55,0,0,1,633,1275.36a115,115,0,0,1,14.18,58.5,111.73,111.73,0,0,1-19.91,68.45,92.78,92.78,0,0,1-47.31,34.62,129.18,129.18,0,0,0,74.67,46.55,370,370,0,0,0,101.8,14.68,226.91,226.91,0,0,0,128.19-38.33,224,224,0,0,0,83.63-113.25,492,492,0,0,0,27.38-169.5,465.07,465.07,0,0,0-29.87-176.23,217.54,217.54,0,0,0-86.37-109.52,229.68,229.68,0,0,0-124.43-35.59,236.75,236.75,0,0,0-107.78,36.59L567.26,932.4V892.33L926.43,410.5H428.62v500A178.9,178.9,0,0,0,456,1012.8a94.34,94.34,0,0,0,83.63,40.07,139.85,139.85,0,0,0,82.63-29.12,298.38,298.38,0,0,0,69.2-71.19,24.86,24.86,0,0,1,9-11.94,18.4,18.4,0,0,1,12-4.48,41.55,41.55,0,0,1,23.4,9.95,49.82,49.82,0,0,1,12.69,33.85,197.86,197.86,0,0,1-4.48,24.89,241,241,0,0,1-85.38,106,211.78,211.78,0,0,1-119.76,36.38q-161.67,0-224-63.72A238.67,238.67,0,0,1,253.2,909.25V410.5H0V317.6H254.38V105.78L196.14,47.5V0h169l63.48,32.86V317.6l657.6-2,65.47,65.71L748.46,786.5a271,271,0,0,1,76.16-18.42A330.1,330.1,0,0,1,972,810.15a302.7,302.7,0,0,1,126.95,113.29,399.78,399.78,0,0,1,57.25,136.65,575.65,575.65,0,0,1,13.69,117,489.39,489.39,0,0,1-49.78,216.79,317.92,317.92,0,0,1-149.35,149.35A483.27,483.27,0,0,1,755.68,1593Z" />
    </svg>
  )
}

/* ------------------------------------------------------------- balance card */

/** Card showing the tez balance + copyable address. Centered & enlarged on
 *  mobile via the .wallet--mobile ancestor. */
export function BalanceCard({
  address,
  query,
}: {
  address: string
  query: ReturnType<typeof useWalletBalance>
}) {
  return (
    <div className="wallet-card wallet-card--balance">
      <span className="wallet-bal__head">
        <WalletIcon size={16} />
        Balance
      </span>
      {query.isLoading ? (
        <Skeleton width={120} height={32} />
      ) : (
        <BalanceAmount mutez={query.data ?? 0} />
      )}
      <CopyAddress address={address} />
    </div>
  )
}

/* ----------------------------------------------------------- fungible tokens */

/** Card holding the fungible balances; the list scrolls inside a capped body. */
export function TokensCard({ query }: { query: ReturnType<typeof useWalletTokens> }) {
  return (
    <div className="wallet-card wallet-card--tokens">
      <header className="wallet-card__head">
        <h3 className="wallet-card__title">
          Tokens
          {query.data?.length != null && (
            <span className="wallet-section__count">{query.data.length}</span>
          )}
        </h3>
      </header>
      <div className="wallet-card__body">
        <TokensContent query={query} />
      </div>
    </div>
  )
}

function TokensContent({ query }: { query: ReturnType<typeof useWalletTokens> }) {
  if (query.isLoading) return <RowsSkeleton rows={3} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const tokens = query.data ?? []
  if (tokens.length === 0) {
    return <EmptyState title="No tokens" message="This wallet holds no fungible tokens." />
  }
  return (
    <ul className="wallet-tokens">
      {tokens.map((t) => (
        <li key={t.key} className="wallet-token">
          <span className="wallet-token__icon">
            {t.thumb ? <Img src={t.thumb} alt="" /> : <span className="wallet-token__fallback">{t.symbol.slice(0, 3)}</span>}
          </span>
          <span className="wallet-token__meta">
            <span className="wallet-token__sym">{t.symbol}</span>
            {t.name !== t.symbol && <span className="wallet-token__name">{t.name}</span>}
          </span>
          <span className="wallet-token__amount">{t.amount}</span>
        </li>
      ))}
    </ul>
  )
}

/* --------------------------------------------------------------- owned NFTs */

export function NftsSection({
  query,
  onViewAll,
}: {
  query: ReturnType<typeof useWalletNfts>
  /** Switch to the full Owned tab; shown only when more NFTs exist than preview. */
  onViewAll: () => void
}) {
  const items = query.data?.items ?? []
  const count = query.data?.count
  const canViewAll = (count ?? 0) > items.length
  return (
    <WalletSection
      title="NFTs"
      count={count}
      action={
        canViewAll ? (
          <button type="button" className="wallet-section__action" onClick={onViewAll}>
            View all
          </button>
        ) : undefined
      }
    >
      <NftsContent query={query} />
    </WalletSection>
  )
}

function NftsContent({ query }: { query: ReturnType<typeof useWalletNfts> }) {
  const openNft = useNftBrowserStore((s) => s.openNft)
  if (query.isLoading) return <NftCellsSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const items = query.data?.items ?? []
  if (items.length === 0) {
    return <EmptyState title="No NFTs" message="This wallet holds no NFTs." />
  }
  // Snapshot for the fullscreen browser's prev/next stepping through the preview.
  const refs = items.map((n) => ({ fa: n.contract, tokenId: n.tokenId }))
  return (
    <div className="nftgrid">
      <div className="nftgrid__cells">
        {items.map((n) => (
          <button
            key={n.key}
            type="button"
            className="nftcard"
            title={n.name}
            onClick={() => openNft(n.contract, n.tokenId, refs)}
          >
            <div className="nftcard__thumb">
              {n.thumb ? <Img src={n.thumb} alt={n.name} /> : <span className="nftcard__noimg">{n.name}</span>}
            </div>
            <span className="nftcard__name">{n.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- transactions */

export function ActivitySection({
  address,
  query,
}: {
  address: string
  query: ReturnType<typeof useWalletActivity>
}) {
  return (
    <WalletSection title="Activity">
      <ActivityContent address={address} query={query} />
    </WalletSection>
  )
}

function ActivityContent({
  address,
  query,
}: {
  address: string
  query: ReturnType<typeof useWalletActivity>
}) {
  if (query.isLoading) return <RowsSkeleton rows={6} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const txs = query.data ?? []
  if (txs.length === 0) {
    return <EmptyState title="No activity" message="No recent transactions." />
  }
  return (
    <ul className="wallet-activity">
      {txs.map((tx) => {
        const sent = tx.direction === 'out'
        // A contract call with no tez moved reads as its entrypoint; otherwise
        // it's a value transfer with a signed amount.
        const isCall = tx.amount === 0 && !!tx.entrypoint
        return (
          <li key={tx.id}>
            <a
              className="wallet-tx"
              href={`https://tzkt.io/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={`wallet-tx__dir wallet-tx__dir--${tx.direction}`} aria-hidden="true">
                <TxArrow direction={tx.direction} />
              </span>
              <span className="wallet-tx__meta">
                <span className="wallet-tx__kind">
                  {isCall ? tx.entrypoint : sent ? 'Sent' : tx.direction === 'self' ? 'Self' : 'Received'}
                </span>
                <span className="wallet-tx__party">{tx.party.alias || shortAddr(tx.party.address)}</span>
              </span>
              <span className="wallet-tx__right">
                {tx.amount > 0 && (
                  <span className={`wallet-tx__amount wallet-tx__amount--${sent ? 'out' : 'in'}`}>
                    {sent ? '−' : '+'}
                    {formatTez(tx.amount)} <TezSign />
                  </span>
                )}
                <span className="wallet-tx__time">{relativeTime(tx.timestamp)}</span>
              </span>
            </a>
          </li>
        )
      })}
      <li className="wallet-activity__more">
        <a href={`https://tzkt.io/${address}/operations`} target="_blank" rel="noopener noreferrer">
          Full history on TzKT
        </a>
      </li>
    </ul>
  )
}

/* ------------------------------------------------------------------ glyphs */

function TxArrow({ direction }: { direction: 'in' | 'out' | 'self' }) {
  if (direction === 'self') {
    return (
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    )
  }
  // Down-left = received, up-right = sent.
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {direction === 'in' ? (
        <>
          <path d="M7 7l10 10" />
          <path d="M17 7v10H7" />
        </>
      ) : (
        <>
          <path d="M7 17L17 7" />
          <path d="M7 7h10v10" />
        </>
      )}
    </svg>
  )
}

function CopyGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/* --------------------------------------------------------------- skeletons */

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="wallet-tokens" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="wallet-token">
          <Skeleton circle width={36} height={36} />
          <span className="wallet-token__meta">
            <Skeleton width={80} height={13} />
          </span>
          <Skeleton width={56} height={13} />
        </li>
      ))}
    </ul>
  )
}

function NftCellsSkeleton() {
  return (
    <div className="nftgrid">
      <div className="nftgrid__cells">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="nftcard">
            <Skeleton className="nftcard__thumb" height="auto" />
            <Skeleton width="70%" height={13} />
          </div>
        ))}
      </div>
    </div>
  )
}
