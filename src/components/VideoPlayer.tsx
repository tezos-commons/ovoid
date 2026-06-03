import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AppBskyEmbedVideo } from '@atproto/api'

/**
 * Bluesky videos are HLS (.m3u8). Safari plays them natively; every other
 * browser needs hls.js, which we dynamic-import only once a video is actually
 * played so the ~400KB library stays out of the main bundle.
 *
 * The poster is a button (click loads the player); the playing container stops
 * click propagation so the native controls don't bubble up to the post-card
 * navigation handler.
 */
export function VideoPlayer({ video }: { video: AppBskyEmbedVideo.View }) {
  const [active, setActive] = useState(false)
  const ar = video.aspectRatio
  const style: CSSProperties | undefined = ar
    ? { aspectRatio: `${ar.width} / ${ar.height}` }
    : undefined

  if (!active) {
    return (
      <button
        type="button"
        className="embed embed--video"
        style={style}
        aria-label="Play video"
        onClick={(e) => {
          e.stopPropagation()
          setActive(true)
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
      <HlsVideo src={video.playlist} poster={video.thumbnail} />
    </div>
  )
}

function HlsVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    let hls: { destroy(): void } | undefined

    // Safari (and iOS) play HLS natively — no library needed.
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src
      void el.play().catch(() => {})
      return
    }

    void import('hls.js').then(({ default: Hls }) => {
      const video = ref.current
      if (cancelled || !video) return
      if (Hls.isSupported()) {
        const inst = new Hls({ enableWorker: true })
        inst.loadSource(src)
        inst.attachMedia(video)
        inst.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => {}))
        hls = inst
      } else {
        // Last resort: let the browser try the playlist URL directly.
        video.src = src
        void video.play().catch(() => {})
      }
    })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])

  return (
    <video
      ref={ref}
      className="embed-video__el"
      controls
      autoPlay
      playsInline
      poster={poster}
    />
  )
}
