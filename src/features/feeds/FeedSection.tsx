import type { ReactNode } from 'react'
import { Skeleton } from '@/components'

/** Labeled section divider used between groups in the feeds tabs. */
export function SectionHeader({
  icon,
  label,
  hint,
}: {
  icon: ReactNode
  label: string
  hint?: string
}) {
  return (
    <div className="feeds__section">
      <span className="feeds__section-icon">{icon}</span>
      <span className="feeds__section-label">{label}</span>
      {hint && <span className="feeds__section-hint">{hint}</span>}
    </div>
  )
}

/** Placeholder rows while a feed list loads. */
export function FeedListSkeleton() {
  return (
    <div className="feeds__list" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="feedcard feedcard--skeleton" key={i}>
          <Skeleton width={48} height={48} radius={8} />
          <div className="feedcard__body">
            <Skeleton width="55%" height={15} />
            <Skeleton width="35%" height={13} />
            <Skeleton width="80%" height={13} />
          </div>
        </div>
      ))}
    </div>
  )
}
