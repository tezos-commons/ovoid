import type { Agent, BlobRef } from '@atproto/api'

const MAX_BYTES = 1_000_000 // 1MB — Bluesky's per-blob image ceiling.
const MAX_DIMENSION = 2000 // downscale longest edge to this before re-encoding.

/**
 * Downscale + re-encode an image File so it fits under 1MB. Returns a JPEG/PNG
 * Blob. If the source is already small enough and not oversized, returns it
 * unchanged. Uses canvas; binary-searches JPEG quality to land under the cap.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (file.size <= MAX_BYTES && !/gif/i.test(file.type)) {
    // GIFs would lose animation through canvas; pass small non-gifs through.
    const bmp = await tryDimensions(file)
    if (!bmp || (bmp.width <= MAX_DIMENSION && bmp.height <= MAX_DIMENSION)) return file
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable for image compression')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  let quality = 0.92
  let blob = await toBlob(canvas, quality)
  while (blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.1
    blob = await toBlob(canvas, quality)
  }
  return blob
}

/** Compress then uploadBlob; returns the BlobRef for embedding. */
export async function uploadImage(agent: Agent, file: File): Promise<BlobRef> {
  const blob = await compressImage(file)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const res = await agent.uploadBlob(bytes, { encoding: blob.type || 'image/jpeg' })
  return res.data.blob
}

async function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      quality,
    )
  })
}

async function tryDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file)
    const dims = { width: bmp.width, height: bmp.height }
    bmp.close()
    return dims
  } catch {
    return null
  }
}
