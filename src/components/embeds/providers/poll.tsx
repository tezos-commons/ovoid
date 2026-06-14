import { useState } from 'react'
import clsx from 'clsx'
import type { ExternalEmbedMatcher } from '../external-registry'
import type { ExternalEmbedProps } from '../GenericExternalCard'
import { GenericExternalCard } from '../GenericExternalCard'
import { Spinner } from '../../Spinner'
import { useAgent } from '@/lib/api/agent'
import { haptic } from '@/lib/haptics'
import { absoluteTime } from '@/lib/time'
import type { Poll } from '@/lib/poll/client'
import { usePoll, usePollResults, useVote, useClosePoll } from '@/features/poll/use-poll'
import './poll.css'

const POLL_PATH = /^\/p\/([^/]+)\/?$/

const KIND_LABEL: Record<Poll['kind'], string> = {
  single: 'Pick one',
  multi: 'Pick any',
  ranked: 'Rank in order',
}

/** Detect a poll.ovoid.at/poll/<id> link and render the interactive poll card. */
function PollEmbed({ external }: ExternalEmbedProps) {
  const id = (() => {
    try {
      return new URL(external.uri).pathname.match(POLL_PATH)?.[1]
    } catch {
      return undefined
    }
  })()
  if (!id) return <GenericExternalCard external={external} />
  return <PollCard id={id} external={external} />
}

export const pollMatcher: ExternalEmbedMatcher = {
  id: 'poll',
  test: (url) => url.hostname === 'poll.ovoid.at' && POLL_PATH.test(url.pathname),
  Component: PollEmbed,
}

function PollCard({ id, external }: { id: string; external: ExternalEmbedProps['external'] }) {
  const { did } = useAgent()
  const pollQ = usePoll(id)
  const [sel, setSel] = useState<number[]>([])
  const voteM = useVote(id)

  if (pollQ.isLoading) {
    return (
      <div className="poll poll--loading">
        <Spinner />
      </div>
    )
  }
  // Unresolvable (deleted, service down): fall back to a plain link card so the
  // message/post still shows something tappable.
  if (pollQ.isError || !pollQ.data) return <GenericExternalCard external={external} />

  const { poll, viewerHasVoted, resultsVisible } = pollQ.data
  const closed = poll.closed || (poll.closesAt != null && poll.closesAt * 1000 <= Date.now())
  const canVote = !!did && !viewerHasVoted && !closed
  const isCreator = !!did && did === poll.creatorDid

  const toggle = (idx: number) => {
    if (poll.kind === 'single') {
      setSel([idx])
      return
    }
    // multi + ranked both accumulate distinct indices; ranked keeps click order.
    setSel((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]))
  }
  const valid = poll.kind === 'single' ? sel.length === 1 : sel.length >= 1

  return (
    <div className="poll" onClick={(e) => e.stopPropagation()}>
      <div className="poll__head">
        <span className="poll__badge">{KIND_LABEL[poll.kind]}</span>
        {poll.visibility === 'private' && <span className="poll__badge poll__badge--muted">Private</span>}
        <CopyLink url={external.uri} />
      </div>
      <div className="poll__question">{poll.question}</div>

      {canVote ? (
        <>
          <ul className="poll__options">
            {poll.options.map((o) => {
              const rank = sel.indexOf(o.idx)
              const selected = rank !== -1
              return (
                <li key={o.idx}>
                  <button
                    type="button"
                    className={clsx('poll-opt', selected && 'poll-opt--selected')}
                    onClick={() => toggle(o.idx)}
                  >
                    <span className="poll-opt__mark" data-kind={poll.kind}>
                      {poll.kind === 'ranked' ? (selected ? rank + 1 : '') : selected ? '✓' : ''}
                    </span>
                    <span className="poll-opt__text">{o.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {voteM.error && <div className="poll__error">{voteM.error.message}</div>}
          <button
            type="button"
            className="poll__vote"
            disabled={!valid || voteM.isPending}
            onClick={() => voteM.mutate(sel)}
          >
            {voteM.isPending ? 'Voting…' : 'Vote'}
          </button>
        </>
      ) : (
        <PollResultsView
          id={id}
          poll={poll}
          resultsVisible={resultsVisible}
          closed={closed}
          voted={viewerHasVoted}
        />
      )}

      <div className="poll__footer">
        <PollMeta poll={poll} closed={closed} />
        {(viewerHasVoted || (isCreator && !closed)) && (
          <span className="poll__footer-right">
            {viewerHasVoted && <span className="poll__voted">You voted</span>}
            {isCreator && !closed && <CloseButton id={id} />}
          </span>
        )}
      </div>
    </div>
  )
}

/** Results bars (when visible) or a status line (voted but hidden / closed). */
function PollResultsView({
  id,
  poll,
  resultsVisible,
  closed,
  voted,
}: {
  id: string
  poll: Poll
  resultsVisible: boolean
  closed: boolean
  voted: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  // A private poll that isn't closed yet exposes its tally to the CREATOR only
  // (that's why resultsVisible is true here for them). Keep it behind an explicit
  // preview so the owner isn't biased by a live count before they close it.
  const creatorPreview = poll.visibility === 'private' && !closed && resultsVisible
  const showBars = resultsVisible && (!creatorPreview || revealed)
  const resultsQ = usePollResults(id, showBars)

  if (!resultsVisible) {
    return (
      <div className="poll__status">
        {voted ? 'You voted — results stay hidden until the poll closes.' : 'Results hidden.'}
      </div>
    )
  }

  if (creatorPreview && !revealed) {
    return (
      <div className="poll__status">
        <span>Hidden from voters until you close the poll.</span>
        <button type="button" className="poll__preview" onClick={() => setRevealed(true)}>
          Preview results
        </button>
      </div>
    )
  }

  if (resultsQ.isLoading) {
    return (
      <div className="poll--loading">
        <Spinner />
      </div>
    )
  }

  const results = resultsQ.data
  const total = results?.total ?? poll.voteCount
  // Map result counts back onto the poll's option order (results may omit zeros).
  const counts = new Map(results?.options.map((o) => [o.idx, o.count]))

  return (
    <>
      {creatorPreview && <div className="poll__preview-note">Only you can see this — voters see results after you close.</div>}
      <ul className="poll__results">
        {poll.options.map((o) => {
          const count = counts.get(o.idx) ?? 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const winner = results?.kind === 'ranked' && results.winnerIdx === o.idx
          return (
            <li key={o.idx} className={clsx('poll-res', winner && 'poll-res--winner')}>
              <div className="poll-res__bar" style={{ width: `${pct}%` }} aria-hidden="true" />
              <span className="poll-res__text">
                {o.text}
                {winner && <span className="poll-res__winner"> · winner</span>}
              </span>
              <span className="poll-res__pct">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function PollMeta({ poll, closed }: { poll: Poll; closed: boolean }) {
  const votes = `${poll.voteCount} ${poll.voteCount === 1 ? 'vote' : 'votes'}`
  let when = ''
  if (closed) when = 'closed'
  else if (poll.closesAt != null) when = `closes ${absoluteTime(poll.closesAt * 1000, { year: undefined })}`
  return (
    <span className="poll__metatext">
      {votes}
      {when && ` · ${when}`}
    </span>
  )
}

/** Top-right copy-link button with transient "copied" feedback. */
function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(url)
      haptic('light')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <button
      type="button"
      className="poll__copy"
      onClick={copy}
      aria-label="Copy poll link"
      title="Copy link"
    >
      {copied ? <CheckGlyph /> : <CopyGlyph />}
    </button>
  )
}

function CopyGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function CloseButton({ id }: { id: string }) {
  const closeM = useClosePoll(id)
  return (
    <button
      type="button"
      className="poll__close"
      disabled={closeM.isPending}
      onClick={() => closeM.mutate()}
    >
      {closeM.isPending ? 'Closing…' : 'Close poll'}
    </button>
  )
}
