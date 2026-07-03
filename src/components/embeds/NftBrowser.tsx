import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '../Spinner'
import { Avatar } from '../Avatar'
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icon'
import { relativeTime } from '@/lib/time'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { useAgent } from '@/lib/api/agent'
import { useNftBrowserStore, stashShowcaseReturn } from '@/store/nft-browser-store'
import { useEntityProfile } from '@/features/address/use-address'
import { profileOptions } from '@/features/profile/use-profile'
import {
  useInterestingTokens,
  indexerFileUrl,
  type ShowcaseEvent,
} from '@/features/onchain/use-interesting-tokens'
import { useCloseOnBack } from '@/lib/use-close-on-back'
import { ModelViewer } from './ModelViewer'
import { AudioPlayer, TransportBar, useMediaTransport } from './AudioPlayer'
import { useArtifactStore } from '@/store/artifact-store'
import {
  useTezosToken,
  tezosTokenOptions,
  useTezosTokenDetails,
  useArtistTokens,
  isModel,
  isAudio,
  isInteractive,
  isVideo,
  isImageArtifact,
  proxyImage,
  ipfsToSubdomain,
  formatPrice,
  shortAddr,
  type TokenDetails,
} from './providers/objkt-data'

type Pane = 'activity' | 'details' | 'artist'

/**
 * Fullscreen NFT browser. Artwork on the left over black, a details panel on
 * the right, and an "artist" tab listing the creator's other tokens in a grid.
 * Clicking a grid item re-points the browser at that token (in place). ESC or
 * the close button — or clicking the backdrop around the art — closes it.
 *
 * Mounted once at the app root; renders nothing until a token preview opens it.
 */
export function NftBrowser() {
  // Per-field selectors — see ArtifactPlayer; the browser is mounted at the
  // root for its whole life, so a whole-store subscription would tick on every
  // openNft/go write even while it renders null.
  const open = useNftBrowserStore((s) => s.open)
  const fa = useNftBrowserStore((s) => s.fa)
  const tokenId = useNftBrowserStore((s) => s.tokenId)
  const list = useNftBrowserStore((s) => s.list)
  const index = useNftBrowserStore((s) => s.index)
  const showcase = useNftBrowserStore((s) => s.showcase)
  const openNft = useNftBrowserStore((s) => s.openNft)
  const go = useNftBrowserStore((s) => s.go)
  const close = useNftBrowserStore((s) => s.close)
  const [pane, setPane] = useState<Pane>('details')
  // Mobile showcase pull-up sheet (title/creator collapsed, activity pulled up).
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetTouchY = useRef<number | null>(null)

  const hasPrev = index > 0
  const hasNext = index >= 0 && index < list.length - 1
  const canStep = list.length > 1

  const base = useTezosToken(fa, tokenId)
  const details = useTezosTokenDetails(fa, tokenId, open)
  const artist = useArtistTokens(base.data?.creatorAddress, open && pane === 'artist')
  const navigate = useNavigate()

  // Navigations OUT of the browser (creator, activity actors). Leaving an open
  // showcase stashes the story first — the overlay isn't a route, so Back
  // alone can't restore it; HomeScreen re-opens it from the marker on POP.
  const leaveTo = (path: string) => {
    if (showcase && index >= 0) stashShowcaseReturn(list, index)
    close()
    navigate(path)
  }

  // Resolve the creator to a Bluesky account (if their wallet is linked) or the
  // standalone tz profile; clicking opens it directly (closing the viewer).
  const creator = useEntityProfile(base.data?.creatorAddress)
  const openCreator = () => {
    if (creator.path) leaveTo(creator.path)
  }

  // Arrow keys step through the collection while open. ESC is handled globally
  // (useEscapeBack) as a back-step. Skip paging while a fullscreen artifact is
  // on top, so its keys don't move the token hidden behind it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (useArtifactStore.getState().mode === 'full') return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, go])

  // Back button / back-swipe closes the viewer instead of navigating the route.
  useCloseOnBack(open, close)

  // Each (re)open starts with the sheet collapsed.
  useEffect(() => {
    if (open) setSheetOpen(false)
  }, [open])

  const onSheetTouchStart = (e: React.TouchEvent) => {
    sheetTouchY.current = e.touches[0]?.clientY ?? null
  }
  const onSheetTouchEnd = (e: React.TouchEvent) => {
    const y0 = sheetTouchY.current
    sheetTouchY.current = null
    const y1 = e.changedTouches[0]?.clientY
    if (y0 == null || y1 == null) return
    const dy = y1 - y0
    if (dy < -24) setSheetOpen(true)
    else if (dy > 24) setSheetOpen(false)
    // A plain tap (no meaningful movement) falls through to the click toggle.
  }

  // Lock document scroll while open. We lock the documentElement (the real
  // scroller — body overflow doesn't propagate to the viewport because html has
  // overflow-x: clip) and drop scrollbar-gutter, so no reserved gutter or live
  // scrollbar leaves a strip down the right edge of the fullscreen overlay.
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    const prevGutter = html.style.scrollbarGutter
    html.style.overflow = 'hidden'
    html.style.scrollbarGutter = 'auto'
    return () => {
      html.style.overflow = prevOverflow
      html.style.scrollbarGutter = prevGutter
    }
  }, [open])

  // Reset the pane whenever the viewed token changes: the showcase leads with
  // WHY the token is recommended (friend activity), free browsing with details.
  // The panel body also scrolls back to the top — a long activity/details list
  // left mid-scroll otherwise makes the next token's pane look unchanged.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setPane(showcase ? 'activity' : 'details')
    bodyRef.current?.scrollTo({ top: 0 })
  }, [fa, tokenId, showcase])

  // Story swipe (showcase): a mostly-horizontal flick steps the sequence.
  // Surfaces with their own gestures opt out — model orbit drags, transport
  // seeking and video taps must not double as navigation.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0]
    if (!t0 || (e.target as Element).closest('.nftb__modelwrap, .audiop, video')) {
      touchStart.current = null
      return
    }
    touchStart.current = { x: t0.clientX, y: t0.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current
    touchStart.current = null
    const t0 = e.changedTouches[0]
    if (!s || !t0) return
    const dx = t0.clientX - s.x
    const dy = t0.clientY - s.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
  }

  // Warm the neighbours' previews while stepping a sequence, so prev/next (and
  // story taps) paint instantly instead of hitting objkt cold.
  useEffect(() => {
    if (!open || index < 0) return
    for (const ref of [list[index - 1], list[index + 1]]) {
      if (!ref) continue
      const opts = tezosTokenOptions(ref.fa, ref.tokenId)
      schedulePrefetch(opts.queryKey, () => queryClient.prefetchQuery(opts))
    }
  }, [open, index, list])

  if (!open || !fa || !tokenId) return null

  const t = base.data

  return (
    // Clicking anywhere on the backdrop closes; the image and the panel stop
    // propagation so only the surrounding background dismisses the view.
    <div
      className={clsx('nftb', showcase && 'nftb--showcase')}
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      {/* Blurred, darkened artwork wash behind everything for depth/colour.
          For video tokens the wash is the video itself (muted twin of the
          foreground player) — the display still is often thumbnail-sized and
          reads as a blocky smear even under heavy blur. The two players drift
          slightly out of sync, which a 64px blur makes imperceptible. */}
      {t && isVideo(t) && t.artifact ? (
        <video
          className="nftb__backdrop"
          src={t.artifact}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
      ) : (
        t?.image && (
          <div
            className="nftb__backdrop"
            style={{ backgroundImage: `url(${t.image})` }}
            aria-hidden
          />
        )
      )}

      {/* Showcase: an in-flow top bar — stories progress (one segment per
          token, filled through the current) beside the close button — so the
          strip has its own section instead of overlaying art/panel content. */}
      {showcase ? (
        <div className="nftb__topbar" onClick={stopClick}>
          {list.length > 1 && (
            <div className="nftb__progress" aria-hidden>
              {list.map((r, i) => (
                <span
                  key={`${r.fa}/${r.tokenId}`}
                  className={clsx('nftb__progress-seg', i <= index && 'nftb__progress-seg--done')}
                />
              ))}
            </div>
          )}
          <button
            className="nftb__close nftb__close--bar"
            onClick={close}
            aria-label="Close"
          >
            <CloseIcon size={22} />
          </button>
        </div>
      ) : (
        <button className="nftb__close" onClick={close} aria-label="Close">
          <CloseIcon size={22} />
        </button>
      )}

      <div className="nftb__stage">
      <div
        className="nftb__art"
        onTouchStart={showcase ? onTouchStart : undefined}
        onTouchEnd={showcase ? onTouchEnd : undefined}
      >
        {/* Marketplace link, top-right over the artwork; rebuilt from the
            current token so it follows in-browser navigation. */}
        <a
          className="nftb__source"
          href={`https://objkt.com/tokens/${fa}/${tokenId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          objkt ↗
        </a>

        {/* Step through the collection this token was opened from. Hidden when
            there's no sequence (single token, or opened from the artist tab). */}
        {canStep && (
          <>
            <button
              className="nftb__nav nftb__nav--prev"
              aria-label="Previous token"
              disabled={!hasPrev}
              onClick={(e) => {
                e.stopPropagation()
                go(-1)
              }}
            >
              <ChevronLeftIcon size={26} />
            </button>
            <button
              className="nftb__nav nftb__nav--next"
              aria-label="Next token"
              disabled={!hasNext}
              onClick={(e) => {
                e.stopPropagation()
                go(1)
              }}
            >
              <ChevronRightIcon size={26} />
            </button>
          </>
        )}

        {!t ? (
          <Spinner size="lg" />
        ) : isModel(t) && t.artifact ? (
          // Stop propagation so orbiting the model doesn't close the view; the
          // surrounding art padding still closes it.
          <div className="nftb__modelwrap" onClick={(e) => e.stopPropagation()}>
            <ModelViewer src={t.artifact} poster={t.image} alt={t.name ?? ''} />
          </div>
        ) : isInteractive(t) && t.artifactUri ? (
          <InteractiveArtifact
            src={ipfsToSubdomain(t.artifactUri) ?? ''}
            poster={proxyImage(t.displayUri, 'hero') ?? t.image}
            title={t.name ?? ''}
            fa={fa}
            tokenId={tokenId}
          />
        ) : isAudio(t) && t.artifact ? (
          <AudioArtifact
            image={proxyImage(t.displayUri, 'hero') ?? t.image}
            audio={t.artifact}
            alt={t.name ?? ''}
          />
        ) : isVideo(t) && t.artifact ? (
          <VideoArtifact
            video={t.artifact}
            poster={proxyImage(t.displayUri, 'hero') ?? t.image}
            alt={t.name ?? ''}
          />
        ) : t.image || (isImageArtifact(t) && t.artifact) ? (
          <FullResImage
            preview={proxyImage(t.displayUri, 'hero') ?? t.image}
            full={isImageArtifact(t) ? t.artifact : undefined}
            alt={t.name ?? ''}
          />
        ) : (
          <Spinner size="lg" />
        )}

        {/* Story tap zones (mobile showcase, CSS-gated): left third = back,
            right two thirds = forward — the Instagram-stories convention. */}
        {showcase && canStep && (
          <>
            <button
              className="nftb__tapzone nftb__tapzone--prev"
              aria-label="Previous token"
              onClick={(e) => {
                e.stopPropagation()
                go(-1)
              }}
            />
            <button
              className="nftb__tapzone nftb__tapzone--next"
              aria-label="Next token"
              onClick={(e) => {
                e.stopPropagation()
                go(1)
              }}
            />
          </>
        )}

      </div>

      <aside className="nftb__panel" onClick={(e) => e.stopPropagation()}>
        <div className="nftb__head">
          <div className="nftb__title">{t?.name || 'Untitled'}</div>
          {(creator.name || t?.creator) &&
            (creator.path ? (
              <button type="button" className="nftb__creator nftb__creator--link" onClick={openCreator}>
                {creator.avatar && <Avatar src={creator.avatar} alt="" size="xs" />}
                <span>by {creator.name || t?.creator}</span>
              </button>
            ) : (
              <div className="nftb__creator">by {t?.creator}</div>
            ))}
        </div>

        <div className="nftb__tabs" role="tablist">
          {showcase && (
            <button
              role="tab"
              aria-selected={pane === 'activity'}
              className={pane === 'activity' ? 'nftb__tab nftb__tab--active' : 'nftb__tab'}
              onClick={() => setPane('activity')}
            >
              Activity
            </button>
          )}
          <button
            role="tab"
            aria-selected={pane === 'details'}
            className={pane === 'details' ? 'nftb__tab nftb__tab--active' : 'nftb__tab'}
            onClick={() => setPane('details')}
          >
            Details
          </button>
          <button
            role="tab"
            aria-selected={pane === 'artist'}
            className={pane === 'artist' ? 'nftb__tab nftb__tab--active' : 'nftb__tab'}
            onClick={() => setPane('artist')}
          >
            By artist
          </button>
        </div>

        <div className="nftb__body" ref={bodyRef}>
          {pane === 'activity' ? (
            <ActivityPane
              // Remount per token: guarantees no stale reconciliation state
              // (e.g. per-row prefetch refs) survives a showcase step.
              key={`${fa}/${tokenId}`}
              fa={fa}
              tokenId={tokenId}
              onNavigate={leaveTo}
            />
          ) : pane === 'details' ? (
            <DetailsPane description={t?.description} details={details.data} loading={details.isLoading} />
          ) : (
            <ArtistGrid
              loading={artist.isLoading}
              tokens={artist.data}
              currentFa={fa}
              currentToken={tokenId}
              onOpen={openNft}
            />
          )}
        </div>
      </aside>
      </div>

      {/* Mobile pull-up sheet (CSS shows it only in the mobile showcase):
          collapsed = grab handle + title + tappable creator; pulled up it
          reveals the same friend-activity list the desktop panel shows. */}
      {showcase && (
        <div
          className={clsx('nftb__sheet', sheetOpen && 'nftb__sheet--open')}
          onClick={stopClick}
        >
          <button
            type="button"
            className="nftb__sheet-head"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((o) => !o)}
            onTouchStart={onSheetTouchStart}
            onTouchEnd={onSheetTouchEnd}
          >
            <span className="nftb__sheet-grab" aria-hidden />
            <span className="nftb__sheet-titlerow">
              <span className="nftb__sheet-title">{t?.name || 'Untitled'}</span>
              <span className="nftb__sheet-hint">{sheetOpen ? 'Hide' : 'Activity'}</span>
            </span>
          </button>
          {(creator.name || t?.creator) && (
            <button
              type="button"
              className="nftb__sheet-creator"
              disabled={!creator.path}
              onClick={() => creator.path && leaveTo(creator.path)}
            >
              {creator.avatar && (
                <span
                  className={clsx('nftb__actor-av', creator.isBsky && 'nftb__actor-av--atproto')}
                >
                  <Avatar src={creator.avatar} alt="" size="xs" />
                </span>
              )}
              <span className="nftb__sheet-creatorname">by {creator.name || t?.creator}</span>
            </button>
          )}
          <div className="nftb__sheet-fold">
            <div className="nftb__sheet-foldinner">
              <div className="nftb__sheet-body">
                <ActivityPane
                  key={`${fa}/${tokenId}`}
                  fa={fa}
                  tokenId={tokenId}
                  onNavigate={leaveTo}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- interactive / audio */

const stopClick = (e: React.MouseEvent) => e.stopPropagation()

/**
 * Fullscreen image with progressive quality: paints the hero transcode (1600px
 * webp of the downscaled display_uri) immediately, then swaps to the original
 * artifact — the actual mint, often multi-MB off an IPFS gateway — once it has
 * decoded off-screen. The swap is src-only on an identically-laid-out <img>,
 * so it's a repaint, not a reflow.
 */
function FullResImage({
  preview,
  full,
  alt,
}: {
  preview?: string
  full?: string
  alt: string
}) {
  const [src, setSrc] = useState(preview ?? full)
  useEffect(() => {
    setSrc(preview ?? full)
    if (!full || full === preview) return
    let alive = true
    const img = new Image()
    img.src = full
    img
      .decode()
      .then(() => {
        if (alive) setSrc(full)
      })
      .catch(() => {
        /* gateway error or undecodable — keep the hero transcode */
      })
    return () => {
      alive = false
    }
  }, [preview, full])

  if (!src) return null
  return <img className="nftb__img" src={src} alt={alt} onClick={stopClick} />
}

/**
 * Interactive HTML artifact (objkt application/x-directory etc.) — shown as the
 * cover poster with a launch button. Launching hands off to the root-level
 * ArtifactPlayer, which mounts the (sandboxed) iframe so it can persist into the
 * draggable mini-player. The click is a user gesture, so the artifact's audio is
 * allowed to play.
 */
function InteractiveArtifact({
  src,
  poster,
  title,
  fa,
  tokenId,
}: {
  src: string
  poster?: string
  title: string
  fa: string
  tokenId: string
}) {
  const open = useArtifactStore((s) => s.open)
  return (
    <div className="nftb__modelwrap nftb__modelwrap--launch" onClick={stopClick}>
      <button className="nftb__launch" onClick={() => open({ src, title, fa, tokenId })}>
        {poster && <img src={poster} alt={title} />}
        <span className="nftb__launch-btn">▶ Play interactive</span>
      </button>
    </div>
  )
}

/**
 * Video artifact with the custom transport beneath it (the artifact IS the
 * video; display_uri is just a still). `muted` autoplay is load-bearing:
 * browsers block unmuted autoplay, and a video that never starts keeps showing
 * its (low-res) poster forever — the first real frames only replace the poster
 * once playback begins. Sound is the transport's mute toggle; tapping the
 * video itself toggles play/pause.
 */
function VideoArtifact({
  video,
  poster,
  alt,
}: {
  video: string
  poster?: string
  alt: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const transport = useMediaTransport(videoRef, video)

  return (
    <div className="nftb__videowrap" onClick={stopClick}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="nftb__img"
        src={video}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        aria-label={alt}
        onClick={transport.toggle}
        {...transport.mediaProps}
      />
      <TransportBar transport={transport} showMute className="nftb__video-ctl" />
    </div>
  )
}

/** Audio track: cover art with the custom transport beneath it. */
function AudioArtifact({
  image,
  audio,
  alt,
}: {
  image?: string
  audio: string
  alt: string
}) {
  return (
    <div className="nftb__audio" onClick={stopClick}>
      {image && <img className="nftb__audio-cover" src={image} alt={alt} />}
      <AudioPlayer src={audio} className="nftb__audio-ctl" />
    </div>
  )
}

/* ----------------------------------------------------------------- activity pane */

/**
 * Action groups for the activity pane, in intent order — strongest purchase
 * signals first (mirrors the indexer's scoring weights). Cancels and anything
 * unrecognised fall through to "Other".
 */
const ACTIVITY_GROUPS: { key: string; title: string }[] = [
  { key: 'list_buy', title: 'Bought' },
  { key: 'offer_accept', title: 'Accepted offers' },
  { key: 'english_auction_bid', title: 'Bids' },
  { key: 'offer_create', title: 'Offers' },
  { key: 'list_create', title: 'Listed' },
  { key: 'balance', title: 'Holding' },
  { key: 'other', title: 'Other activity' },
]

function activityGroupKey(ev: ShowcaseEvent): string {
  if (ev.kind === 'balance_change') return 'balance'
  switch (ev.marketplace_event_type) {
    case 'list_buy':
    case 'offer_accept':
    case 'english_auction_bid':
    case 'offer_create':
    case 'list_create':
      return ev.marketplace_event_type
    default:
      return 'other'
  }
}

/** Human verb, shown only inside the "Other" group where the heading is vague. */
function eventVerb(ev: ShowcaseEvent): string {
  switch (ev.marketplace_event_type) {
    case 'list_cancel':
      return 'delisted'
    case 'offer_cancel':
      return 'withdrew offer'
    default:
      return (ev.marketplace_event_type ?? ev.event_type ?? 'activity').replace(/_/g, ' ')
  }
}

/**
 * Why this token is recommended: the friend / friend-of-friend events that
 * scored it, straight off the interesting-tokens response (already in cache —
 * the showcase can only be opened from that data), grouped by action so the
 * strongest signals (purchases) read first instead of one long mixed list.
 */
function ActivityPane({
  fa,
  tokenId,
  onNavigate,
}: {
  fa: string
  tokenId: string
  /** Close the browser and go (actor rows navigate to profiles/addresses). */
  onNavigate: (path: string) => void
}) {
  const q = useInterestingTokens()
  const token = q.data?.find((t) => t.contract === fa && t.token_id === tokenId)

  if (!token) {
    return q.isLoading ? (
      <div className="nftb__loading">
        <Spinner size="sm" />
      </div>
    ) : (
      <Muted>No friend activity for this token.</Muted>
    )
  }

  const groups = ACTIVITY_GROUPS.map((g) => ({
    ...g,
    events: token.events.filter((ev) => activityGroupKey(ev) === g.key),
  })).filter((g) => g.events.length > 0)

  return (
    <div className="nftb__details">
      <div className="nftb__reach">
        Activity from {token.reach} {token.reach === 1 ? 'collector' : 'collectors'} in your
        network
      </div>
      {groups.map((g) => (
        <Section key={g.key} title={g.events.length > 1 ? `${g.title} · ${g.events.length}` : g.title}>
          {g.events.map((ev, i) => (
            <ActivityEventRow
              key={ev.id ?? `${ev.actor}-${i}`}
              ev={ev}
              showVerb={g.key === 'other'}
              onNavigate={onNavigate}
            />
          ))}
        </Section>
      ))}
    </div>
  )
}

/**
 * One contributing event. Linked actors (tzbsky) show their Bluesky identity —
 * avatar via the indexer's thumb route, display name, profile link warmed on
 * dwell; unlinked ones fall back to the short address → /address view.
 */
function ActivityEventRow({
  ev,
  showVerb,
  onNavigate,
}: {
  ev: ShowcaseEvent
  /** The "Other" group's heading is vague, so its rows spell the action out. */
  showVerb?: boolean
  onNavigate: (path: string) => void
}) {
  const { agent } = useAgent()
  const bskyActor = ev.actor_handle || ev.actor_did
  const dest = bskyActor ? `/profile/${bskyActor}` : `/address/${ev.actor}`

  const prefetchRef = usePrefetchOnVisible<HTMLButtonElement>(() => {
    if (!bskyActor) return
    const profile = profileOptions(agent, bskyActor)
    schedulePrefetch(profile.queryKey, () => queryClient.prefetchQuery(profile))
  })

  return (
    <div className="nftb__row nftb__row--event">
      <button
        type="button"
        ref={prefetchRef}
        className="nftb__actor"
        title={bskyActor ? `@${ev.actor_handle ?? ev.actor_did}` : ev.actor}
        onClick={() => onNavigate(dest)}
      >
        <span
          className={clsx('nftb__actor-av', ev.actor_has_atproto && 'nftb__actor-av--atproto')}
          title={ev.actor_has_atproto ? 'Bluesky account' : undefined}
        >
          <Avatar
            size="xs"
            src={indexerFileUrl(ev.actor_avatar)}
            alt=""
            fallback={ev.actor_name ?? ev.actor.slice(3)}
          />
        </span>
        <span className="nftb__actor-name">{ev.actor_name ?? shortAddr(ev.actor)}</span>
      </button>
      <span
        className="nftb__degree"
        title={ev.distance === 1 ? 'Someone you follow / co-collect with' : 'Friend of a friend'}
      >
        {ev.distance === 1 ? '1°' : '2°'}
      </span>
      {showVerb && <span className="nftb__row-type">{eventVerb(ev)}</span>}
      <span className="nftb__row-meta">
        {ev.kind === 'balance_change' && ev.balance != null && ev.balance !== '1' && (
          <span className="nftb__row-price">×{ev.balance}</span>
        )}
        {ev.price_xtz != null && (
          <span className="nftb__row-price">{formatPrice(ev.price_xtz, 1)}</span>
        )}{' '}
        {ev.timestamp != null && relativeTime(ev.timestamp)}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ details pane */

function DetailsPane({
  description,
  details,
  loading,
}: {
  description?: string
  details: TokenDetails | null | undefined
  loading: boolean
}) {
  return (
    <div className="nftb__details">
      {description && <p className="nftb__desc">{description}</p>}

      {loading && !details ? (
        <div className="nftb__loading">
          <Spinner size="sm" />
        </div>
      ) : details ? (
        <>
          {details.supply != null && (
            <Section title="Editions">
              <div className="nftb__row">
                <span className="nftb__row-meta">Total minted</span>
                <span>{details.supply}</span>
              </div>
            </Section>
          )}
          <Section title="Listings">
            {details.listings.length === 0 ? (
              <Muted>Not listed.</Muted>
            ) : (
              details.listings.map((l, i) => (
                <div key={i} className="nftb__row">
                  <span className="nftb__row-price">{formatPrice(l.price, l.currencyId)}</span>
                  <span className="nftb__row-meta">
                    {l.amount} ed · {shortAddr(l.seller)}
                  </span>
                </div>
              ))
            )}
          </Section>
          <Section title="Offers">
            {details.offers.length === 0 ? (
              <Muted>No offers.</Muted>
            ) : (
              details.offers.map((o, i) => (
                <div key={i} className="nftb__row">
                  <span className="nftb__row-price">{formatPrice(o.price, o.currencyId)}</span>
                  <span className="nftb__row-meta">{shortAddr(o.buyer)}</span>
                </div>
              ))
            )}
          </Section>
          <Section title="History">
            {details.events.length === 0 ? (
              <Muted>No history.</Muted>
            ) : (
              details.events.map((e, i) => (
                <div key={i} className="nftb__row">
                  <span className="nftb__row-type">{e.type}</span>
                  <span className="nftb__row-meta">
                    {e.price != null && <span className="nftb__row-price">{formatPrice(e.price, 1)}</span>}{' '}
                    {relativeTime(e.at)}
                  </span>
                </div>
              ))
            )}
          </Section>
        </>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="nftb__section">
      <div className="nftb__section-title">{title}</div>
      {children}
    </div>
  )
}

function Muted({ children }: { children: string }) {
  return <div className="nftb__muted">{children}</div>
}

/* ------------------------------------------------------------------- artist grid */

function ArtistGrid({
  loading,
  tokens,
  currentFa,
  currentToken,
  onOpen,
}: {
  loading: boolean
  tokens: ReturnType<typeof useArtistTokens>['data']
  currentFa: string
  currentToken: string
  onOpen: (fa: string, tokenId: string) => void
}) {
  if (loading && !tokens) {
    return (
      <div className="nftb__loading">
        <Spinner size="sm" />
      </div>
    )
  }
  if (!tokens || tokens.length === 0) return <Muted>No other works.</Muted>

  return (
    <div className="nftb__grid">
      {tokens.map((tk) => {
        const current = tk.fa === currentFa && tk.tokenId === currentToken
        return (
          <button
            key={`${tk.fa}/${tk.tokenId}`}
            className={current ? 'nftb__cell nftb__cell--current' : 'nftb__cell'}
            onClick={() => onOpen(tk.fa, tk.tokenId)}
            title={tk.name}
          >
            {tk.image && <img src={tk.image} alt={tk.name ?? ''} loading="lazy" />}
          </button>
        )
      })}
    </div>
  )
}
