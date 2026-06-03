import { create } from 'zustand'
import { useUiStore, type Theme } from '@/store/ui-store'

/**
 * Appearance store for the two appearance axes that are NOT the colour theme
 * (the colour theme lives in ui-store and is shared with the pre-paint script).
 *
 *  - fontScale: multiplies the base type scale via the `--font-scale` custom
 *    property the stylesheet reads (1 = default 15px body).
 *  - fontFamily: 'system' swaps `--font-family` to the native stack; 'inter'
 *    keeps the self-hosted Inter variable. We override the property on
 *    documentElement so a single var change re-flows the whole tree.
 *
 * Both persist to localStorage and are applied pre-paint at module load to
 * avoid a flash of the default appearance.
 */

export type FontScale = 'small' | 'default' | 'large' | 'larger'
export type FontFamily = 'inter' | 'system'

const SCALE_KEY = 'ovoid:font-scale'
const FAMILY_KEY = 'ovoid:font-family'

const SCALE_VALUE: Record<FontScale, string> = {
  small: '0.9333', // ~14px body
  default: '1',
  large: '1.0667', // ~16px body
  larger: '1.1333', // ~17px body
}

const SYSTEM_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const INTER_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

function readScale(): FontScale {
  if (typeof localStorage === 'undefined') return 'default'
  const v = localStorage.getItem(SCALE_KEY)
  return v === 'small' || v === 'large' || v === 'larger' ? v : 'default'
}

function readFamily(): FontFamily {
  if (typeof localStorage === 'undefined') return 'inter'
  return localStorage.getItem(FAMILY_KEY) === 'system' ? 'system' : 'inter'
}

function applyScale(scale: FontScale) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--font-scale', SCALE_VALUE[scale])
}

function applyFamily(family: FontFamily) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty(
    '--font-family',
    family === 'system' ? SYSTEM_STACK : INTER_STACK,
  )
}

export interface AppearanceState {
  fontScale: FontScale
  fontFamily: FontFamily
  setFontScale: (s: FontScale) => void
  setFontFamily: (f: FontFamily) => void
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  fontScale: readScale(),
  fontFamily: readFamily(),
  setFontScale: (fontScale) => {
    applyScale(fontScale)
    try {
      localStorage.setItem(SCALE_KEY, fontScale)
    } catch {
      /* storage unavailable; property still set */
    }
    set({ fontScale })
  },
  setFontFamily: (fontFamily) => {
    applyFamily(fontFamily)
    try {
      localStorage.setItem(FAMILY_KEY, fontFamily)
    } catch {
      /* storage unavailable */
    }
    set({ fontFamily })
  },
}))

// Apply persisted appearance at module load (belt-and-braces).
applyScale(readScale())
applyFamily(readFamily())

/**
 * Thin re-export of the shared theme slice so appearance code has a single
 * import surface. The colour theme is owned by ui-store (shared with the
 * pre-paint inline script); we never fork it.
 */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  return { theme, setTheme }
}

export type { Theme }
