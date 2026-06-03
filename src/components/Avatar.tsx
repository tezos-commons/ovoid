import clsx from 'clsx'

export interface AvatarProps {
  src?: string
  alt?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'round' | 'rounded-square'
  /** Initial shown when there is no src. */
  fallback?: string
}

export function Avatar({ src, alt = '', size = 'md', shape = 'round', fallback }: AvatarProps) {
  const cls = clsx('av', `av--${size}`, `av--${shape}`)
  if (src) {
    return (
      <span className={cls}>
        <img src={src} alt={alt} loading="lazy" />
      </span>
    )
  }
  const initial = (fallback ?? alt ?? '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span className={cls} aria-label={alt || undefined}>
      {initial}
    </span>
  )
}
