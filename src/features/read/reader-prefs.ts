import { create } from 'zustand'

/**
 * Reader appearance — fully DECOUPLED from the app's colour theme / appearance.
 *
 * The reader has its own theme (incl. sepia), text size and typeface. They apply
 * as `data-reader-*` attributes on <html>, which the reader CSS reads *scoped to
 * `.rdr`* — so the regular app's `data-theme`/`--font-scale` are never touched,
 * and switching between the app and the reader can't flash the wrong settings.
 *
 * Preloaded at module import (the attributes are set before any reader paints),
 * cached in localStorage, and mirrored to backend.ovoid.at via settings-sync (which
 * reads/writes this store like the other settings stores).
 */
export type ReaderTheme = 'light' | 'dim' | 'dark' | 'sepia'
export type ReaderFontSize = 'small' | 'default' | 'large' | 'larger'
export type ReaderFont = 'sans' | 'serif'

export const READER_THEMES: ReaderTheme[] = ['light', 'sepia', 'dim', 'dark']
export const READER_SIZES: ReaderFontSize[] = ['small', 'default', 'large', 'larger']

const THEME_KEY = 'ovoid:reader-theme'
const SIZE_KEY = 'ovoid:reader-size'
const FONT_KEY = 'ovoid:reader-font'

function readEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
const readTheme = () => readEnum<ReaderTheme>(THEME_KEY, READER_THEMES, 'dim')
const readSize = () => readEnum<ReaderFontSize>(SIZE_KEY, READER_SIZES, 'default')
const readFont = (): ReaderFont => {
  try {
    return localStorage.getItem(FONT_KEY) === 'serif' ? 'serif' : 'sans'
  } catch {
    return 'sans'
  }
}

function setAttr(name: string, value: string) {
  if (typeof document !== 'undefined') document.documentElement.setAttribute(name, value)
}
const applyTheme = (t: ReaderTheme) => setAttr('data-reader-theme', t)
const applySize = (s: ReaderFontSize) => setAttr('data-reader-size', s)
const applyFont = (f: ReaderFont) => setAttr('data-reader-font', f)

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable; attribute still applied */
  }
}

interface ReaderPrefsState {
  theme: ReaderTheme
  fontSize: ReaderFontSize
  fontFamily: ReaderFont
  setTheme: (t: ReaderTheme) => void
  setFontSize: (s: ReaderFontSize) => void
  setFontFamily: (f: ReaderFont) => void
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
}

export const useReaderPrefs = create<ReaderPrefsState>((set) => ({
  theme: readTheme(),
  fontSize: readSize(),
  fontFamily: readFont(),
  setTheme: (theme) => {
    applyTheme(theme)
    persist(THEME_KEY, theme)
    set({ theme })
  },
  setFontSize: (fontSize) => {
    applySize(fontSize)
    persist(SIZE_KEY, fontSize)
    set({ fontSize })
  },
  setFontFamily: (fontFamily) => {
    applyFont(fontFamily)
    persist(FONT_KEY, fontFamily)
    set({ fontFamily })
  },
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}))

// Preload: apply persisted reader appearance at module load, before the reader
// renders, so app ↔ reader navigation never paints with the wrong settings.
applyTheme(readTheme())
applySize(readSize())
applyFont(readFont())
