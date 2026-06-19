import { create } from 'zustand'

/**
 * Language preferences. The primary (app/post default) language and a set of
 * content languages used to filter feeds. Stored locally; the post composer can
 * read `primary` for the `langs` field on new posts.
 */

export interface LanguageOption {
  code: string
  label: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
]

const PRIMARY_KEY = 'ovoid:lang:primary'
const CONTENT_KEY = 'ovoid:lang:content'

function readPrimary(): string {
  if (typeof localStorage === 'undefined') return 'en'
  return localStorage.getItem(PRIMARY_KEY) || 'en'
}

function readContent(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(CONTENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export interface LanguageState {
  primary: string
  content: string[]
  setPrimary: (code: string) => void
  toggleContent: (code: string) => void
  /** Replace the whole content-language set (used when hydrating from sync). */
  setContent: (codes: string[]) => void
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  primary: readPrimary(),
  content: readContent(),
  setPrimary: (primary) => {
    try {
      localStorage.setItem(PRIMARY_KEY, primary)
    } catch {
      /* storage unavailable */
    }
    set({ primary })
  },
  toggleContent: (code) => {
    const next = get().content.includes(code)
      ? get().content.filter((c) => c !== code)
      : [...get().content, code]
    try {
      localStorage.setItem(CONTENT_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
    set({ content: next })
  },
  setContent: (content) => {
    try {
      localStorage.setItem(CONTENT_KEY, JSON.stringify(content))
    } catch {
      /* storage unavailable */
    }
    set({ content })
  },
}))
