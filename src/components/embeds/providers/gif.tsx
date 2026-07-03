import { useState, type CSSProperties } from 'react'
import { useAccessibilityStore } from '@/features/settings/accessibility-store'
import type { ExternalEmbedMatcher } from '../external-registry'
import type { ExternalEmbedProps } from '../GenericExternalCard'

/**
 * GIF links (Klipy / Tenor / Giphy) render as inline playing media instead of
 * a link card. Bluesky's composer sources gifs from Klipy (previously Tenor);
 * both have video transcodes behind a Bluesky caching proxy (k.gifs.bsky.app /
 * t.gifs.bsky.app) — a webm/mp4 an order of magnitude smaller than the gif,
 * played as a looping muted <video>. Anything else matching a direct .gif URL
 * renders as a plain <img> (gifs self-animate).
 *
 * The accessibility "autoplay" toggle gates playback: off → the card thumb
 * with a play glyph, click to start (same pattern as VideoPlayer).
 */

interface GifSource {
  /** Video transcodes, preferred-first. Empty → fall back to the raw gif img. */
  video: { src: string; type: string }[]
  gif: string
  width?: number
  height?: number
}

function parseGif(uri: string): GifSource | null {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return null
  }
  if (!url.pathname.endsWith('.gif')) return null

  const w = Number(url.searchParams.get('ww')) || undefined
  const h = Number(url.searchParams.get('hh')) || undefined

  // Klipy media URL: https://static.klipy.com/ii/<hash>/xx/yy/<slug>.gif
  //   ?hh=..&ww=..&mp4=<slug>&webm=<slug>
  // The mp4/webm params are filename slugs (Klipy names each format
  // differently, unlike Tenor's id scheme); the composer embeds them at post
  // time. Swap the proxy host in, drop the params, and replace the filename
  // with <slug>.<ext> to get the video transcodes.
  if (url.hostname === 'static.klipy.com' && url.pathname.startsWith('/ii/')) {
    const base = new URL(url.href)
    base.hostname = 'k.gifs.bsky.app'
    base.search = ''
    const swap = (slug: string, ext: string) => {
      const u = new URL(base.href)
      const parts = u.pathname.split('/')
      parts[parts.length - 1] = `${slug}.${ext}`
      u.pathname = parts.join('/')
      return u.href
    }
    const webm = url.searchParams.get('webm')
    const mp4 = url.searchParams.get('mp4')
    const video: GifSource['video'] = []
    if (webm) video.push({ src: swap(webm, 'webm'), type: 'video/webm' })
    if (mp4) video.push({ src: swap(mp4, 'mp4'), type: 'video/mp4' })
    return { video, gif: base.href, width: w, height: h }
  }

  if (!/(^|\.)(tenor|giphy)\.com$/.test(url.hostname)) return null

  // Tenor media URL: https://media.tenor.com/<id>AAAAC/<name>.gif?hh=..&ww=..
  const [, id, filename] = url.pathname.split('/')
  if (url.hostname === 'media.tenor.com' && id?.includes('AAAAC') && filename) {
    return {
      video: [
        {
          src: `https://t.gifs.bsky.app/${id.replace('AAAAC', 'AAAP3')}/${filename.replace('.gif', '.webm')}`,
          type: 'video/webm',
        },
        {
          src: `https://t.gifs.bsky.app/${id.replace('AAAAC', 'AAAP1')}/${filename.replace('.gif', '.mp4')}`,
          type: 'video/mp4',
        },
      ],
      gif: uri,
      width: w,
      height: h,
    }
  }
  return { video: [], gif: uri, width: w, height: h }
}

function GifEmbed({ external }: ExternalEmbedProps) {
  const autoplay = useAccessibilityStore((s) => s.autoplay)
  const [clicked, setClicked] = useState(false)
  const gif = parseGif(external.uri)
  if (!gif) return null

  // The composer stores the user's alt text (or Tenor's description) in the
  // link card description, sometimes with an "ALT:" prefix.
  const alt = (external.description || external.title || 'GIF').replace(/^alt:\s*/i, '')
  const style: CSSProperties | undefined =
    gif.width && gif.height ? { aspectRatio: `${gif.width} / ${gif.height}` } : undefined

  if (!autoplay && !clicked) {
    return (
      <button
        type="button"
        className="embed embed--video embed--gif"
        style={style}
        aria-label={`Play GIF: ${alt}`}
        onClick={(e) => {
          e.stopPropagation()
          setClicked(true)
        }}
      >
        {external.thumb && <img src={external.thumb} alt={alt} loading="lazy" />}
        <span className="embed-video__play" aria-hidden>
          ▶
        </span>
      </button>
    )
  }

  return (
    <div className="embed embed--video embed--gif" style={style} onClick={(e) => e.stopPropagation()}>
      {gif.video.length > 0 ? (
        <video
          className="embed-video__el"
          autoPlay
          loop
          muted
          playsInline
          poster={external.thumb}
          aria-label={alt}
        >
          {gif.video.map((v) => (
            <source key={v.src} src={v.src} type={v.type} />
          ))}
        </video>
      ) : (
        <img className="embed-gif__img" src={gif.gif} alt={alt} loading="lazy" />
      )}
    </div>
  )
}

export const gifMatcher: ExternalEmbedMatcher = {
  id: 'gif',
  test: (url) => parseGif(url.href) !== null,
  Component: GifEmbed,
  // A gif is its own media, not a preview of the post's images — never drop
  // an image embed on its account.
  preservesImageEmbed: true,
}
