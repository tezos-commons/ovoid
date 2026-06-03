import clsx from 'clsx'
import type { CSSProperties } from 'react'

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  circle?: boolean
  className?: string
}

/** Shimmering placeholder block. Inline styles keep call sites terse. */
export function Skeleton({ width, height = 16, radius, circle, className }: SkeletonProps) {
  const style: CSSProperties = {
    width,
    height,
    borderRadius: circle ? '50%' : (radius ?? 6),
  }
  return <span className={clsx('skeleton', className)} style={style} aria-hidden="true" />
}
