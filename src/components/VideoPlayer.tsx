import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { AppBskyEmbedVideo } from '@atproto/api'
import { useAccessibilityStore } from '@/features/settings/accessibility-store'

/**
 * Bluesky videos are HLS (.m3u8). Safari plays them natively; every other
 * browser needs hls.js, which we dynamic-import only once a video actually
 * needs to play so the ~400KB library stays out of the main bundle.
 *
 * Playback follows the accessibility "autoplay" toggle:
 * - autoplay on (default): the player mounts immediately but stays inert until
 *   it enters the viewport, then plays muted; scrolling it away pauses it, so
 *   at most the on-screen videos stream. Native controls handle unmute.
 * - autoplay off: the poster is a button; clicking loads the player and plays
 *   with sound (a user gesture, so unmuted autoplay is allowed).
 *
 * The playing container stops click propagation so the native controls don't
 * bubble up to the post-card navigation handler.
 */
export function VideoPlayer({ video }: { video: AppBskyEmbedVideo.View }) {
  const autoplay = useAccessibilityStore((s) => s.autoplay)
  const [clicked, setClicked] = useState(false)
  const ar = video.aspectRatio
  const style: CSSProperties | undefined = ar
    ? { aspectRatio: `${ar.width} / ${ar.height}` }
    : undefined

  if (!autoplay && !clicked) {
    return (
      <button
        type="button"
        className="embed embed--video"
        style={style}
        aria-label="Play video"
        onClick={(e) => {
          e.stopPropagation()
          setClicked(true)
        }}
      >
        {video.thumbnail && (
          <img src={video.thumbnail} alt={video.alt ?? ''} loading="lazy" />
        )}
        <span className="embed-video__play" aria-hidden>
          ▶
        </span>
      </button>
    )
  }

  return (
    <div className="embed embed--video" style={style} onClick={(e) => e.stopPropagation()}>
      <HlsVideo src={video.playlist} poster={video.thumbnail} muted={!clicked} lazy={!clicked} />
    </div>
  )
}

/** True while ~a third of the element is in the viewport. Only observes when
 * enabled; disabled callers get a constant false and pay nothing. */
function useInView(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.33,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, enabled])
  return inView
}

function HlsVideo({
  src,
  poster,
  muted,
  lazy,
}: {
  src: string
  poster?: string
  muted: boolean
  /** Defer source attach until visible, and pause when scrolled off-screen. */
  lazy: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const inView = useInView(ref, lazy)
  const wantPlay = !lazy || inView
  const wantPlayRef = useRef(wantPlay)
  wantPlayRef.current = wantPlay

  // Latches true the first time playback is wanted — the source stays attached
  // across visibility changes; only play/pause toggles after that.
  const [load, setLoad] = useState(!lazy)
  useEffect(() => {
    if (wantPlay) setLoad(true)
  }, [wantPlay])

  useEffect(() => {
    if (!load) return
    const el = ref.current
    if (!el) return
    let cancelled = false
    let hls: { destroy(): void } | undefined

    const startIfWanted = (video: HTMLVideoElement) => {
      if (wantPlayRef.current) void video.play().catch(() => {})
    }

    // Safari (and iOS) play HLS natively — no library needed.
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src
      startIfWanted(el)
      return
    }

    void import('hls.js').then(({ default: Hls }) => {
      const video = ref.current
      if (cancelled || !video) return
      if (Hls.isSupported()) {
        const inst = new Hls({ enableWorker: true })
        inst.loadSource(src)
        inst.attachMedia(video)
        inst.on(Hls.Events.MANIFEST_PARSED, () => startIfWanted(video))
        hls = inst
      } else {
        // Last resort: let the browser try the playlist URL directly.
        video.src = src
        startIfWanted(video)
      }
    })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src, load])

  useEffect(() => {
    const el = ref.current
    if (!el || !load || !lazy) return
    if (wantPlay) void el.play().catch(() => {})
    else el.pause()
  }, [wantPlay, load, lazy])

  return (
    <video
      ref={ref}
      className="embed-video__el"
      controls
      muted={muted}
      loop={lazy}
      playsInline
      poster={poster}
    />
  )
}
