import { useEffect, useRef, useState, type PointerEvent } from 'react'
import clsx from 'clsx'
import { CloseIcon } from '../Icon'
import { useArtifactStore } from '@/store/artifact-store'
import { useNftBrowserStore } from '@/store/nft-browser-store'

const MINI_W = 320
const MINI_H = 240
const MARGIN = 16

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Root-level player for interactive NFT artifacts. The iframe is mounted here
 * (and only here) so it persists — audio keeps playing — across fullscreen ⇄
 * mini, and after the NFT browser closes.
 *
 * Fullscreen: large iframe inset within a scrim border, ESC minimises.
 * Mini: a small window pinned bottom-left, draggable by its bar (pointer
 * capture routes the drag over the iframe); the bar's close/expand icons
 * appear on hover.
 *
 * Security: cross-origin (dweb.link per-CID subdomain) so it can't touch this
 * app's origin; sandboxed to scripts only (no popups/forms/top-navigation);
 * no referrer leaked.
 */
export function ArtifactPlayer() {
  // Per-field selectors — a whole-store subscription would re-render this (and
  // everything below it) on any artifact-state write, even while closed.
  const mode = useArtifactStore((s) => s.mode)
  const src = useArtifactStore((s) => s.src)
  const title = useArtifactStore((s) => s.title)
  const fa = useArtifactStore((s) => s.fa)
  const tokenId = useArtifactStore((s) => s.tokenId)
  const minimize = useArtifactStore((s) => s.minimize)
  const expand = useArtifactStore((s) => s.expand)
  const close = useArtifactStore((s) => s.close)
  const closeBrowser = useNftBrowserStore((s) => s.close)
  const openBrowser = useNftBrowserStore((s) => s.openNft)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null)

  // Minimising drops the (now-redundant) NFT browser; expanding re-opens it so
  // the artifact docks back into its art column alongside the details panel.
  const onMinimize = () => {
    minimize()
    closeBrowser()
  }
  const onExpand = () => {
    if (fa && tokenId) openBrowser(fa, tokenId)
    expand()
  }

  // ESC handling lives in the global useEscapeBack handler: from fullscreen it
  // closes the artifact (stops playback) as a back-step. The ⤡ control is the
  // explicit minimise-and-keep-playing path.

  // Default mini position: bottom-left.
  useEffect(() => {
    if (mode === 'mini' && !pos) {
      setPos({ x: MARGIN, y: window.innerHeight - MINI_H - MARGIN })
    }
  }, [mode, pos])

  if (mode === 'closed' || !src) return null

  const onPointerDown = (e: PointerEvent) => {
    if (mode !== 'mini') return
    const p = pos ?? { x: MARGIN, y: window.innerHeight - MINI_H - MARGIN }
    dragOffset.current = { dx: e.clientX - p.x, dy: e.clientY - p.y }
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || !dragOffset.current) return
    setPos({
      x: clamp(e.clientX - dragOffset.current.dx, 0, window.innerWidth - MINI_W),
      y: clamp(e.clientY - dragOffset.current.dy, 0, window.innerHeight - MINI_H),
    })
  }
  const onPointerUp = (e: PointerEvent) => {
    setDragging(false)
    dragOffset.current = null
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  const isMini = mode === 'mini'
  const style = isMini && pos ? { left: pos.x, top: pos.y } : undefined

  return (
    <div
      className={clsx(
        'artplayer',
        isMini ? 'artplayer--mini' : 'artplayer--full',
        dragging && 'artplayer--dragging',
      )}
      style={style}
    >
      <div
        className="artplayer__bar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="artplayer__title">{title}</span>
        <div className="artplayer__controls">
          <button
            type="button"
            className="artplayer__btn"
            onClick={isMini ? onExpand : onMinimize}
            aria-label={isMini ? 'Expand' : 'Minimize'}
            title={isMini ? 'Expand' : 'Minimize'}
          >
            {isMini ? '⤢' : '⤡'}
          </button>
          <button
            type="button"
            className="artplayer__btn"
            onClick={close}
            aria-label="Close"
            title="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      <iframe
        className="artplayer__frame"
        src={src}
        title={title ?? 'Interactive artifact'}
        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        allow="autoplay; fullscreen; xr-spatial-tracking; gamepad"
        referrerPolicy="no-referrer"
      />
    </div>
  )
}
