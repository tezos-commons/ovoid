const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Compact relative time used in post headers: now, 5m, 3h, 2d, then a date. */
export function relativeTime(input: string | number | Date, now: number = Date.now()): string {
  const then = new Date(input).getTime()
  const diff = now - then
  if (!Number.isFinite(then)) return ''
  if (diff < MINUTE) return 'now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d`
  return absoluteTime(input, { year: undefined })
}

/** Time-of-day (e.g. "3:07 PM") — chat message timestamps. */
export function clockTime(input: string | number | Date): string {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Full localized timestamp for focused posts / tooltips. */
export function absoluteTime(
  input: string | number | Date,
  opts: { year?: 'numeric' | undefined } = {},
): string {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: opts.year === undefined && d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}
