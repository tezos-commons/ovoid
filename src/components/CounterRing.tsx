/**
 * Circular character-count progress ring used by every composer. Fills as
 * `count` approaches `max`; the remaining count appears beside it once near the
 * cap, and the ring turns warning then danger as it fills/overflows.
 */
export function CounterRing({
  count,
  max,
  size = 26,
}: {
  count: number
  max: number
  size?: number
}) {
  const remaining = max - count
  const over = remaining < 0
  const near = !over && remaining <= 20
  const center = size / 2
  const r = (size - 5) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(count / max, 1)
  const color = over
    ? 'var(--color-danger)'
    : near
      ? 'var(--color-like)'
      : 'var(--color-primary)'

  return (
    <span className="counter-ring" title={`${remaining} remaining`}>
      {(near || over) && (
        <span
          className="counter-ring__num"
          style={{ color: over ? 'var(--color-danger)' : 'var(--text-muted)' }}
        >
          {remaining}
        </span>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
    </span>
  )
}
