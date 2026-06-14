import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/* ------------------------------------------------------------------ */
/* Section                                                            */
/* ------------------------------------------------------------------ */

export function Section({
  title,
  desc,
  children,
}: {
  title?: ReactNode
  desc?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="settings-section">
      {title && <h2 className="settings-section__title">{title}</h2>}
      {desc && <p className="settings-section__desc">{desc}</p>}
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Row — either a nav link (chevron) or a static row hosting a control */
/* ------------------------------------------------------------------ */

function ChevronRight() {
  return (
    <svg
      className="settings-chevron"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

interface RowProps {
  icon?: ReactNode
  label: ReactNode
  sub?: ReactNode
  /** Internal route — renders the row as a navigating link with a chevron. */
  to?: string
  /** Imperative action (e.g. sign out). Renders as a button. */
  onClick?: () => void
  trailing?: ReactNode
  danger?: boolean
}

export function Row({ icon, label, sub, to, onClick, trailing, danger }: RowProps) {
  const body = (
    <>
      {icon != null && <span className="settings-row__icon">{icon}</span>}
      <span className="settings-row__body">
        <span className="settings-row__label">{label}</span>
        {sub != null && <span className="settings-row__sub">{sub}</span>}
      </span>
      <span className="settings-row__trailing">
        {trailing}
        {(to || onClick) && <ChevronRight />}
      </span>
    </>
  )

  const cls = clsx('settings-row', (to || onClick) && 'settings-row--link', danger && 'settings-row--danger')

  if (to) {
    return (
      <Link className={cls} to={to}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button className={cls} type="button" onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

/* ------------------------------------------------------------------ */
/* Toggle switch                                                      */
/* ------------------------------------------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={clsx('settings-switch', checked && 'settings-switch--on')}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch__knob" />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                  */
/* ------------------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

export function Segment<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  full,
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (next: T) => void
  ariaLabel: string
  /** Span the full row with equal-width buttons (for many/long labels that would
   *  crowd a trailing slot on narrow screens). */
  full?: boolean
}) {
  return (
    <div
      className={clsx('settings-segment', full && 'settings-segment--full')}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={opt.value === value}
          className={clsx(
            'settings-segment__btn',
            opt.value === value && 'settings-segment__btn--active',
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
