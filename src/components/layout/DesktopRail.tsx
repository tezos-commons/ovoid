import { useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import clsx from 'clsx'
import { Link, useNavigate } from 'react-router-dom'
import { SearchIcon } from '../Icon'
import { PersonCard } from '@/features/search/PersonCard'
import { useTrending, useSuggestedActors } from '@/features/search/use-discover'
import { useAuth } from '@/lib/api/agent'
import { useTezosAddress } from '@/features/profile/use-nfts'
import { useWalletBalance, useWalletActivity } from '@/features/profile/use-wallet'
import { BalanceCard, ActivitySection } from '@/features/profile/WalletParts'
import './rail.css'

/**
 * Default right-rail content, shown by the shell at wide widths to fill the space
 * beside the reading column. Stacked panels: a search box, trending topics, and
 * then either a Tezos wallet overview (when the signed-in viewer has a wallet
 * linked) or who-to-follow. Each unstable source degrades to [] (see use-discover),
 * so an empty panel omits itself rather than rendering blank.
 *
 * A screen with better contextual content replaces all of this via <PageRail>.
 */
export function DesktopRail() {
  const { did } = useAuth()
  // A linked wallet is a one-time signed statement, cached for an hour; null means
  // confirmed-none. Swap who-to-follow for the wallet view only once we know.
  const address = useTezosAddress(did).data ?? null

  return (
    <div className="rail">
      <RailSearch />
      <TrendingPanel />
      {address ? <WalletPanel address={address} /> : <SuggestedPanel />}
    </div>
  )
}

/** Rail search field: submits to the search screen with the query prefilled. */
function RailSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search')
  }

  return (
    <form className="rail-search" role="search" onSubmit={onSubmit}>
      <SearchIcon />
      <input
        className="rail-search__input"
        type="search"
        placeholder="Search"
        value={q}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setQ(e.target.value)}
      />
    </form>
  )
}

function TrendingPanel() {
  const topics = useTrending().data ?? []
  if (topics.length === 0) return null
  return (
    <section className="rail-panel" aria-label="Trending">
      <h2 className="rail-panel__title">Trending</h2>
      <div className="rail-topics">
        {topics.slice(0, 8).map((t) => (
          <Link key={t.link} to={t.link} className="rail-topic">
            {t.topic}
          </Link>
        ))}
      </div>
    </section>
  )
}

function SuggestedPanel() {
  const actors = useSuggestedActors(6).data ?? []
  if (actors.length === 0) return null
  return (
    <section className="rail-panel" aria-label="Who to follow">
      <h2 className="rail-panel__title">Who to follow</h2>
      <div className="rail-people">
        {actors.map((actor) => (
          <PersonCard key={actor.did} actor={actor} compact />
        ))}
      </div>
      <Link to="/search" className="rail-panel__more">
        Show more
      </Link>
    </section>
  )
}

/**
 * Compact wallet overview for the signed-in viewer: tez balance, with recent
 * activity folding out when the balance card is clicked. Reuses the profile wallet
 * tab's BalanceCard / ActivitySection (and its wallet.css), wrapped in
 * `.wallet-top--solo` so the balance card spans full width.
 *
 * Activity is fetched only while expanded (enabled: open) and the fold uses the
 * grid 0fr↔1fr trick so it animates open/closed without measuring height.
 */
function WalletPanel({ address }: { address: string }) {
  const [open, setOpen] = useState(false)
  const balance = useWalletBalance(address)
  const activity = useWalletActivity(address, { enabled: open })
  // The hook fetches 25; the rail only wants the latest few. Cast keeps the shape
  // ActivitySection expects (the UseQueryResult union) after overriding data.
  const recent = { ...activity, data: activity.data?.slice(0, 6) } as typeof activity

  // Toggle on the card, but let the inner copy-address button do its own thing.
  const fromCopy = (target: EventTarget) => target instanceof Element && !!target.closest('.wallet-addr')
  const onClick = (e: MouseEvent) => {
    if (!fromCopy(e.target)) setOpen((o) => !o)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !fromCopy(e.target)) {
      e.preventDefault()
      setOpen((o) => !o)
    }
  }

  return (
    <section className="rail-wallet" aria-label="Wallet">
      <div className="wallet">
        <div
          className="wallet-top wallet-top--solo rail-wallet__toggle"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-controls="rail-wallet-activity"
          onClick={onClick}
          onKeyDown={onKeyDown}
        >
          <BalanceCard address={address} query={balance} />
          <Chevron />
        </div>
        <div
          id="rail-wallet-activity"
          className={clsx('rail-wallet__fold', open && 'rail-wallet__fold--open')}
        >
          <div className="rail-wallet__fold-inner">
            <ActivitySection address={address} query={recent} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Caret that rotates when the wallet activity is expanded (driven by CSS). */
function Chevron() {
  return (
    <svg
      className="rail-wallet__caret"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
