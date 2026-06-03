import type { SVGProps } from 'react'

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Pixel size for both width/height. Defaults to 22. */
  size?: number
  /** Use the filled variant where one exists (active states). */
  filled?: boolean
}

type IconFC = (props: IconProps) => JSX.Element

/**
 * Global glyph-icon scale. Every Icon's requested `size` is multiplied by this
 * factor, so this is the single lever for "make all icons a bit smaller"
 * without touching the ~40 call sites that pass explicit sizes. Avatars use a
 * separate enum and are unaffected.
 */
const ICON_SCALE = 0.85
const DEFAULT_SIZE = 22

function svg(size: number | undefined, rest: SVGProps<SVGSVGElement>) {
  const s = Math.round((size ?? DEFAULT_SIZE) * ICON_SCALE)
  return {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  }
}

export const HomeIcon: IconFC = ({ size, filled, ...rest }) => (
  <svg {...svg(size, rest)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
  </svg>
)

export const SearchIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
)

export const BellIcon: IconFC = ({ size, filled, ...rest }) => (
  <svg {...svg(size, rest)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

export const ChatIcon: IconFC = ({ size, filled, ...rest }) => (
  <svg {...svg(size, rest)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
  </svg>
)

export const HashIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
  </svg>
)

export const ListIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)

export const PersonIcon: IconFC = ({ size, filled, ...rest }) => (
  <svg {...svg(size, rest)} fill={filled ? 'currentColor' : 'none'}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

export const GearIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 6.4 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 3.3 6.4l-.1-.1A2 2 0 1 1 6 3.5l.1.1A1.7 1.7 0 0 0 9 2.4V2a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)

export const HeartIcon: IconFC = ({ size, filled, ...rest }) => (
  <svg {...svg(size, rest)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.5-9.2-9A5 5 0 0 1 12 5a5 5 0 0 1 9.2 6c-2.2 4.5-9.2 9-9.2 9Z" />
  </svg>
)

export const RepostIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)

export const ReplyIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
  </svg>
)

export const ShareIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 3v13M8 7l4-4 4 4" />
  </svg>
)

export const MoreIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)

export const PencilIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

export const BookmarkIcon: IconFC = ({ size, filled, ...rest }) => (
  <svg {...svg(size, rest)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
  </svg>
)

export const CloseIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const BackIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)

export const ChevronLeftIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

export const ChevronRightIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export const BotIcon: IconFC = ({ size, ...rest }) => (
  <svg {...svg(size, rest)}>
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M12 4.5V8" />
    <circle cx="12" cy="3.5" r="1" fill="currentColor" stroke="none" />
    <path d="M9 13.5h.01M15 13.5h.01M2 12.5v2.5M22 12.5v2.5" />
  </svg>
)
