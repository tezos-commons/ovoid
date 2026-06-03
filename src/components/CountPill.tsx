export interface CountPillProps {
  count: number
  /** Cap the displayed number, e.g. max=30 renders "30+". */
  max?: number
}

/** Small unread badge. Renders nothing when count <= 0. */
export function CountPill({ count, max = 99 }: CountPillProps) {
  if (count <= 0) return null
  const label = count > max ? `${max}+` : String(count)
  return <span className="countpill">{label}</span>
}
