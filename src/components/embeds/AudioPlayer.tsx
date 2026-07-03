import {
  useEffect,
  useRef,
  useState,
  type ReactEventHandler,
  type RefObject,
} from 'react'
import clsx from 'clsx'

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface MediaTransport {
  playing: boolean
  time: number
  duration: number
  muted: boolean
  /** Spread onto the <audio>/<video> element so state tracks playback. */
  mediaProps: {
    onPlay: ReactEventHandler<HTMLMediaElement>
    onPause: ReactEventHandler<HTMLMediaElement>
    onEnded: ReactEventHandler<HTMLMediaElement>
    onTimeUpdate: ReactEventHandler<HTMLMediaElement>
    onDurationChange: ReactEventHandler<HTMLMediaElement>
    onVolumeChange: ReactEventHandler<HTMLMediaElement>
  }
  toggle: () => void
  seek: (t: number) => void
  toggleMute: () => void
}

/**
 * Transport state for a media element the caller renders. State resets when
 * `src` changes (stepping tokens in the browser re-uses the same elements).
 */
export function useMediaTransport(
  ref: RefObject<HTMLMediaElement | null>,
  src: string,
): MediaTransport {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setPlaying(false)
    setTime(0)
    setDuration(0)
    // Muted tracks the element (autoplaying video starts muted); read it once
    // the element exists for this src.
    setMuted(ref.current?.muted ?? false)
  }, [src, ref])

  return {
    playing,
    time,
    duration,
    muted,
    mediaProps: {
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onEnded: () => setPlaying(false),
      onTimeUpdate: (e) => setTime(e.currentTarget.currentTime),
      onDurationChange: (e) => setDuration(e.currentTarget.duration),
      onVolumeChange: (e) => setMuted(e.currentTarget.muted),
    },
    toggle: () => {
      const el = ref.current
      if (!el) return
      if (el.paused) void el.play().catch(() => {})
      else el.pause()
    },
    seek: (t) => {
      const el = ref.current
      if (!el) return
      el.currentTime = t
      setTime(t)
    },
    toggleMute: () => {
      const el = ref.current
      if (el) el.muted = !el.muted
    },
  }
}

/**
 * The shared transport bar: round play/pause, elapsed / total time, a seek bar
 * whose played portion is painted into the range track (native range controls
 * can't style the track cross-browser, so the fill is a two-stop gradient),
 * and — for video — a mute toggle, since custom controls remove the native
 * unmute path for muted-autoplay media.
 *
 * Styled for dark artwork surfaces (the NFT browser); taps stop propagating so
 * story tap-zones / backdrop-close handlers around it never steal the press.
 */
export function TransportBar({
  transport: t,
  showMute,
  className,
}: {
  transport: MediaTransport
  showMute?: boolean
  className?: string
}) {
  const played = t.duration > 0 ? Math.min(100, (t.time / t.duration) * 100) : 0

  return (
    <div className={clsx('audiop', className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="audiop__btn"
        onClick={t.toggle}
        aria-label={t.playing ? 'Pause' : 'Play'}
      >
        {t.playing ? (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4.5" height="14" rx="1.5" />
            <rect x="13.5" y="5" width="4.5" height="14" rx="1.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.52.86l10.2-6.5a1 1 0 0 0 0-1.72L9.52 4.64A1 1 0 0 0 8 5.5Z" />
          </svg>
        )}
      </button>
      <span className="audiop__time">{fmt(t.time)}</span>
      <input
        className="audiop__seek"
        type="range"
        min={0}
        max={t.duration || 0}
        step="any"
        value={Math.min(t.time, t.duration || 0)}
        onChange={(e) => t.seek(Number(e.target.value))}
        aria-label="Seek"
        style={{
          background: `linear-gradient(to right, rgba(255,255,255,0.95) ${played}%, rgba(255,255,255,0.22) ${played}%)`,
        }}
      />
      <span className="audiop__time">{fmt(t.duration)}</span>
      {showMute && (
        <button
          type="button"
          className="audiop__mute"
          onClick={t.toggleMute}
          aria-label={t.muted ? 'Unmute' : 'Mute'}
        >
          {t.muted ? (
            <svg
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
              <path d="M11 5.5 6.5 9H3v6h3.5L11 18.5v-13Z" fill="currentColor" stroke="none" />
              <path d="m16 9.5 5 5M21 9.5l-5 5" />
            </svg>
          ) : (
            <svg
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
              <path d="M11 5.5 6.5 9H3v6h3.5L11 18.5v-13Z" fill="currentColor" stroke="none" />
              <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}

/** Self-contained audio player: hidden <audio> + the shared transport bar. */
export function AudioPlayer({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const transport = useMediaTransport(audioRef, src)

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" {...transport.mediaProps} />
      <TransportBar transport={transport} className={className} />
    </>
  )
}
