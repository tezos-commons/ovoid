import { Skeleton } from '@/components'

/** Layout-faithful first-load placeholder for an article. */
export function ReaderSkeleton() {
  return (
    <div className="rdr-article">
      <div className="rdr-pub">
        <Skeleton className="rdr-pub__icon" width={48} height={48} radius={12} />
        <div className="rdr-pub__body">
          <Skeleton width={140} height={16} />
          <Skeleton width="80%" height={12} />
        </div>
      </div>
      <Skeleton width="85%" height={36} />
      <div className="rdr-byline">
        <Skeleton circle width={28} height={28} />
        <Skeleton width={150} height={14} />
      </div>
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} width={i % 4 === 3 ? '55%' : '100%'} height={14} className="rdr-skel-line" />
      ))}
    </div>
  )
}

/** Placeholder rows mirroring the publication article list. */
export function DocListSkeleton() {
  return (
    <ul className="rdr-doclist">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="rdr-doclist__item">
          <Skeleton width="60%" height={20} />
          <Skeleton width="90%" height={12} className="rdr-skel-line" />
        </li>
      ))}
    </ul>
  )
}
