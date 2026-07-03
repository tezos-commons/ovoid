import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { useAgent } from '@/lib/api/agent'
import { profileOptions } from '@/features/profile/use-profile'
import { useFollow } from '@/features/profile/use-follow'
import { formatCount } from '@/features/profile/ProfileCard'

const OPEN_DELAY = 380
const CLOSE_DELAY = 250
const CARD_W = 300
const EDGE = 8

/** Hover cards are a pointer affordance; touch devices never see them. */
function canHover(): boolean {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/**
 * Bluesky-style profile preview on hover. Wrap any inline profile link:
 *
 *   <ProfileHoverCard actor={didOrHandle}><Link …/></ProfileHoverCard>
 *
 * Opens after a short dwell, survives the pointer moving into the card
 * (grace timer), closes on leave or scroll. The card portals to <body> so
 * clipped containers (post cards, chat bubbles) can't cut it off. Data comes
 * from the shared profileOptions — mention links prefetch it on visibility,
 * so the card usually paints from cache.
 */
export function ProfileHoverCard({ actor, children }: { actor: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const hostRef = useRef<HTMLSpanElement>(null)
  const openTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)

  const clearTimers = () => {
    if (openTimer.current !== null) {
      clearTimeout(openTimer.current)
      openTimer.current = null
    }
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  useEffect(() => clearTimers, [])

  // The card is fixed-position; any scroll moves the anchor out from under it,
  // so just dismiss (capture catches inner scrollers, not only the window).
  useEffect(() => {
    if (!open) return
    const onScroll = () => setOpen(false)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [open])

  const show = () => {
    const el = hostRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const left = Math.min(Math.max(r.left, EDGE), window.innerWidth - CARD_W - EDGE)
    // Below the anchor unless the viewport lacks room there; the card is
    // content-sized, so a fixed budget stands in for pre-render measurement.
    const roomBelow = window.innerHeight - r.bottom
    setPos(
      roomBelow > 280
        ? { left, top: r.bottom + 6 }
        : { left, bottom: window.innerHeight - r.top + 6 },
    )
    setOpen(true)
  }

  const onEnter = () => {
    if (!canHover()) return
    clearTimers()
    if (!open) openTimer.current = window.setTimeout(show, OPEN_DELAY)
  }
  const onLeave = () => {
    clearTimers()
    if (open) closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY)
  }
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  return (
    <span className="phc-host" ref={hostRef} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {open &&
        pos &&
        createPortal(
          <div
            className="phc"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
            onMouseEnter={cancelClose}
            onMouseLeave={onLeave}
            // Mentions sit inside surfaces that navigate on click (post cards).
            onClick={(e) => e.stopPropagation()}
          >
            <HoverCardContent actor={actor} onNavigate={() => setOpen(false)} />
          </div>,
          document.body,
        )}
    </span>
  )
}

function HoverCardContent({ actor, onNavigate }: { actor: string; onNavigate: () => void }) {
  const { agent, did: viewerDid } = useAgent()
  const q = useQuery(profileOptions(agent, actor))
  const follow = useFollow(actor)
  const p = q.data

  if (!p) {
    return (
      <div className="phc__loading">
        <Spinner size="sm" />
      </div>
    )
  }

  const isSelf = !!viewerDid && p.did === viewerDid
  // Straight off the profile cache: useFollow patches viewer.following (and
  // followersCount) optimistically on every qk.profile key, so this re-renders
  // through the query — no local button state needed.
  const following = !!p.viewer?.following
  const profilePath = `/profile/${p.handle || p.did}`

  return (
    <>
      <div className="phc__top">
        <Link to={profilePath} onClick={onNavigate}>
          <Avatar src={p.avatar} alt={p.handle} size="md" fallback={p.displayName || p.handle} />
        </Link>
        {viewerDid && !isSelf && (
          <Button
            size="sm"
            variant={following ? 'secondary' : 'primary'}
            loading={follow.isPending}
            onClick={() => follow.mutate(p)}
          >
            {following ? 'Following' : 'Follow'}
          </Button>
        )}
      </div>
      <Link to={profilePath} className="phc__name" onClick={onNavigate}>
        {p.displayName || p.handle}
      </Link>
      <div className="phc__handle">@{p.handle}</div>
      <div className="phc__stats">
        <span>
          <b>{formatCount(p.followersCount)}</b> followers
        </span>
        <span>
          <b>{formatCount(p.followsCount)}</b> following
        </span>
      </div>
      {p.description && <p className="phc__bio">{p.description}</p>}
    </>
  )
}
