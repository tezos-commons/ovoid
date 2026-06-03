import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import type { ExternalEmbedProps } from '../GenericExternalCard'
import { Spinner } from '../../Spinner'
import { relativeTime } from '@/lib/time'
import { useNftBrowserStore } from '@/store/nft-browser-store'
import {
  useTezosToken,
  useTezosTokenDetails,
  formatPrice,
  shortAddr,
  type TokenDetails,
} from './objkt-data'

type Tab = 'listings' | 'offers' | 'history' | 'info'

const TABS: { key: Tab; label: string }[] = [
  { key: 'listings', label: 'Listings' },
  { key: 'offers', label: 'Offers' },
  { key: 'history', label: 'History' },
  { key: 'info', label: 'Info' },
]

const stop = (e: MouseEvent) => e.stopPropagation()

/**
 * Full-size artwork preview for a Tezos NFT link. The image renders at normal
 * embed size; on hover (or keyboard focus) a transparent overlay fades in with
 * a bottom tab bar — Listings / Offers / History / Info — pulled from the objkt
 * indexer. Detail data is fetched lazily (only once armed by hover/focus) so a
 * feed full of token links doesn't fan out detail queries up front. Falls back
 * to the generic link card while the base metadata loads or if it's missing.
 */
export function TokenEmbed({
  external,
  fa,
  tokenId,
  source,
}: ExternalEmbedProps & { fa: string; tokenId: string; source: string }) {
  const base = useTezosToken(fa, tokenId)
  const [armed, setArmed] = useState(false)
  const [tab, setTab] = useState<Tab>('listings')
  const userPicked = useRef(false)
  const details = useTezosTokenDetails(fa, tokenId, armed)
  const openBrowser = useNftBrowserStore((s) => s.openNft)

  const d = details.data
  const description = base.data?.description
  const isEmpty: Record<Tab, boolean> = {
    listings: !!d && d.listings.length === 0,
    offers: !!d && d.offers.length === 0,
    history: !!d && d.events.length === 0,
    info: !description && !!d && d.supply == null,
  }
  // On first reveal, land on the first (left-to-right) tab that has content,
  // unless the viewer has manually chosen a tab.
  const firstNonEmpty = TABS.find((tb) => !isEmpty[tb.key])?.key ?? 'listings'
  useEffect(() => {
    if (!userPicked.current && d) setTab(firstNonEmpty)
  }, [d, firstNonEmpty])

  if (!base.data) {
    // Never degrade to the plain marketplace card. While the token loads (or if
    // the indexer has nothing), show the embed's own thumbnail if present, else
    // render nothing.
    return external.thumb ? (
      <div className="embed embed--token">
        <img className="embed-token__art" src={external.thumb} alt={external.title ?? ''} />
      </div>
    ) : null
  }

  const t = base.data
  const ar = t.aspectRatio
  const style: CSSProperties | undefined = ar
    ? { aspectRatio: `${ar.width} / ${ar.height}` }
    : undefined

  return (
    <div
      className="embed embed--token"
      style={style}
      onMouseEnter={() => setArmed(true)}
      onClick={stop}
    >
      {t.image && <img className="embed-token__art" src={t.image} alt={t.name ?? ''} loading="lazy" />}

      {/* Clicking the overlay's dark background (not a row, tab or link) opens
          the fullscreen NFT browser. */}
      <div
        className="token-overlay"
        onClick={(e) => {
          e.stopPropagation()
          openBrowser(fa, tokenId)
        }}
      >
        <div className="token-overlay__head">
          <div className="token-overlay__titles">
            <div className="token-overlay__name">{t.name || external.title || 'Untitled'}</div>
            {t.creator && <div className="token-overlay__creator">by {t.creator}</div>}
          </div>
          <a
            className="token-overlay__open"
            href={external.uri}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            title={`Open on ${source}`}
          >
            {source} ↗
          </a>
        </div>

        <div className="token-overlay__body">
          <TabBody
            tab={tab}
            details={details.data}
            description={t.description}
            loading={armed && details.isLoading}
          />
        </div>

        <div className="token-overlay__tabs" role="tablist">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              role="tab"
              aria-selected={tab === tb.key}
              className={[
                'token-tab',
                tab === tb.key && 'token-tab--active',
                isEmpty[tb.key] && 'token-tab--empty',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(e) => {
                e.stopPropagation()
                userPicked.current = true
                setTab(tb.key)
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TabBody({
  tab,
  details,
  description,
  loading,
}: {
  tab: Tab
  details: TokenDetails | null | undefined
  description?: string
  loading: boolean
}) {
  // Info is backed by the base metadata, so it renders without waiting on the
  // (lazy) details query.
  if (tab === 'info') {
    return (
      <div className="token-info">
        {description && <p className="token-info__desc">{description}</p>}
        {details?.supply != null && (
          <div className="token-row">
            <span className="token-row__meta">Editions</span>
            <span>{details.supply}</span>
          </div>
        )}
        {!description && details?.supply == null && <Empty>No details.</Empty>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="token-overlay__loading">
        <Spinner size="sm" />
      </div>
    )
  }
  if (!details) return null

  if (tab === 'listings') {
    if (details.listings.length === 0) return <Empty>Not listed for sale.</Empty>
    return (
      <ul className="token-list" onClick={stop}>
        {details.listings.map((l, i) => (
          <li key={i} className="token-row">
            <span className="token-row__price">{formatPrice(l.price, l.currencyId)}</span>
            <span className="token-row__meta">
              {l.amount} ed · {shortAddr(l.seller)}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (tab === 'offers') {
    if (details.offers.length === 0) return <Empty>No active offers.</Empty>
    return (
      <ul className="token-list" onClick={stop}>
        {details.offers.map((o, i) => (
          <li key={i} className="token-row">
            <span className="token-row__price">{formatPrice(o.price, o.currencyId)}</span>
            <span className="token-row__meta">{shortAddr(o.buyer)}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (tab === 'history') {
    if (details.events.length === 0) return <Empty>No history.</Empty>
    return (
      <ul className="token-list" onClick={stop}>
        {details.events.map((e, i) => (
          <li key={i} className="token-row">
            <span className="token-row__type">{e.type}</span>
            <span className="token-row__meta">
              {e.price != null && <span className="token-row__price">{formatPrice(e.price, 1)}</span>}{' '}
              {relativeTime(e.at)}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return null
}

function Empty({ children }: { children: string }) {
  return <div className="token-overlay__empty">{children}</div>
}
