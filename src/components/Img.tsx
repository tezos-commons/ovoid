import { useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react'
import clsx from 'clsx'

/**
 * An <img> that fades in once decoded instead of popping in. The container is
 * expected to reserve the box (aspect-ratio, fixed size, or object-fit slot),
 * so this only smooths the paint — it does not affect layout.
 *
 * Cached images that are already `complete` on mount reveal immediately via the
 * ref check, so warm navigations don't replay the fade. `onError` also reveals,
 * so a broken image shows its alt/broken affordance rather than staying at
 * opacity 0.
 */
export function Img({ className, onLoad, onError, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false)

  const reveal = () => {
    if (!loaded) setLoaded(true)
  }

  return (
    <img
      {...rest}
      loading={rest.loading ?? 'lazy'}
      decoding={rest.decoding ?? 'async'}
      className={clsx('img-fade', loaded && 'img-fade--in', className)}
      ref={(el) => {
        // Cache hit: the image is already decoded before onLoad can fire.
        if (el?.complete) reveal()
      }}
      onLoad={(e: SyntheticEvent<HTMLImageElement>) => {
        reveal()
        onLoad?.(e)
      }}
      onError={(e: SyntheticEvent<HTMLImageElement>) => {
        reveal()
        onError?.(e)
      }}
    />
  )
}
