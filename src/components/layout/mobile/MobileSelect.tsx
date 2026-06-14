import type { ReactNode } from 'react'
import { Menu, type MenuItem } from '../../Menu'

export interface MobileSelectProps {
  /** Current selection, shown in the trigger. */
  label: ReactNode
  items: MenuItem[]
  ariaLabel?: string
  /** Render the dropdown as an icon grid (items must carry `icon`). */
  grid?: boolean
}

/**
 * Top-bar dropdown selector used for screen-level section switching on mobile
 * (Home feeds, Profile tabs, Notifications filter). A pill trigger showing the
 * active label + caret, opening the shared Menu. Lives in a top-bar slot, so it
 * inherits the right-aligned popover (see mobile.css).
 */
export function MobileSelect({ label, items, ariaLabel, grid }: MobileSelectProps) {
  return (
    <Menu
      variant={grid ? 'grid' : 'list'}
      trigger={
        <button type="button" className="mbar-feedsel" aria-label={ariaLabel ?? 'Select'}>
          <span className="mbar-feedsel__label">{label}</span>
          <CaretDownIcon />
        </button>
      }
      items={items}
    />
  )
}

function CaretDownIcon() {
  return (
    <svg className="mbar-feedsel__caret" viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
