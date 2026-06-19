import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '../Spinner'
import { Avatar } from '../Avatar'
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icon'
import { relativeTime } from '@/lib/time'
import { useNftBrowserStore } from '@/store/nft-browser-store'
import { useEntityProfile } from '@/features/address/use-address'
import { useCloseOnBack } from '@/lib/use-close-on-back'
import { ModelViewer } from './ModelViewer'
import { useArtifactStore } from '@/store/artifact-store'
import {
  useTezosToken,
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

type Pane = 'details' | 'artist'

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
  const openNft = useNftBrowserStore((s) => s.openNft)
  const go = useNftBrowserStore((s) => s.go)
  const close = useNftBrowserStore((s) => s.close)
  const [pane, setPane] = useState<Pane>('details')

  const hasPrev = index > 0
  const hasNext = index >= 0 && index < list.length - 1
  const canStep = list.length > 1

  const base = useTezosToken(fa, tokenId)
  const details = useTezosTokenDetails(fa, tokenId, open)
  const artist = useArtistTokens(base.data?.creatorAddress, open && pane === 'artist')
  const navigate = useNavigate()
  // Resolve the creator to a Bluesky account (if their wallet is linked) or the
  // standalone tz profile; clicking opens it directly (closing the viewer).
  const creator = useEntityProfile(base.data?.creatorAddress)
  const openCreator = () => {
    if (!creator.path) return
    close()
    navigate(creator.path)
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

  // Reset to the details pane whenever the viewed token changes.
  useEffect(() => {
    setPane('details')
  }, [fa, tokenId])

  if (!open || !fa || !tokenId) return null

  const t = base.data

  return (
    // Clicking anywhere on the backdrop closes; the image and the panel stop
    // propagation so only the surrounding background dismisses the view.
    <div className="nftb" role="dialog" aria-modal="true" onClick={close}>
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

      <button className="nftb__close" onClick={close} aria-label="Close">
        <CloseIcon size={22} />
      </button>

      <div className="nftb__art">
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
          // The artifact IS the video; display_uri is just a still of it.
          // muted is load-bearing: browsers block unmuted autoplay, and a video
          // that never starts keeps showing its (low-res) poster forever — the
          // first real frames only replace the poster once playback begins.
          // Sound is one tap away on the controls.
          <video
            className="nftb__img"
            src={t.artifact}
            poster={proxyImage(t.displayUri, 'hero') ?? t.image}
            controls
            autoPlay
            muted
            loop
            playsInline
            onClick={(e) => e.stopPropagation()}
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

        <div className="nftb__body">
          {pane === 'details' ? (
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
    <div className="nftb__modelwrap" onClick={stopClick}>
      <button className="nftb__launch" onClick={() => open({ src, title, fa, tokenId })}>
        {poster && <img src={poster} alt={title} />}
        <span className="nftb__launch-btn">▶ Play interactive</span>
      </button>
    </div>
  )
}

/** Audio track: cover art with an audio player beneath it. */
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
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio className="nftb__audio-ctl" src={audio} controls />
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
