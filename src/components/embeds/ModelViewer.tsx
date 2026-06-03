import { useEffect, useState } from 'react'
import { Spinner } from '../Spinner'

// Load the ~heavy web component once, on demand (only when a 3D token is shown).
let modulePromise: Promise<unknown> | null = null
function loadModelViewer(): Promise<unknown> {
  if (!modulePromise) modulePromise = import('@google/model-viewer')
  return modulePromise
}

/**
 * Interactive 3D viewer for GLB/GLTF NFT artifacts, backed by Google's
 * <model-viewer>. The module is code-split and fetched lazily; until it's
 * registered we show the static poster so there's no empty flash.
 */
export function ModelViewer({
  src,
  poster,
  alt,
}: {
  src: string
  poster?: string
  alt?: string
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    void loadModelViewer().then(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  if (!ready) {
    return (
      <div className="nftb__model nftb__model--loading">
        {poster && <img src={poster} alt={alt ?? ''} />}
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <model-viewer
      className="nftb__model"
      // Inline size: a custom element doesn't reliably pick up width/height from
      // a CSS class, and without an explicit size model-viewer collapses to its
      // default 300×150 in the corner.
      style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
      src={src}
      poster={poster}
      alt={alt ?? ''}
      camera-controls
      auto-rotate
      shadow-intensity="1"
      exposure="1"
      loading="eager"
    />
  )
}
