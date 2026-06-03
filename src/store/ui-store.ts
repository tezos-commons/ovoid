import { create } from 'zustand'

export type Theme = 'light' | 'dim' | 'dark'

const THEME_KEY = 'ovoid:theme'

function readTheme(): Theme {
  // Default is the 'dim' purple theme; only an explicit stored choice overrides it.
  if (typeof localStorage === 'undefined') return 'dim'
  const t = localStorage.getItem(THEME_KEY)
  return t === 'light' || t === 'dim' || t === 'dark' ? t : 'dim'
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export interface LightboxState {
  images: { src: string; alt?: string }[]
  index: number
}

export interface UiState {
  /** Stack of open modal ids; the compose modal listens for 'compose'. */
  modalStack: string[]
  openModal: (id: string) => void
  closeModal: (id?: string) => void
  isModalOpen: (id: string) => boolean

  lightbox: LightboxState | null
  openLightbox: (state: LightboxState) => void
  closeLightbox: () => void

  theme: Theme
  setTheme: (theme: Theme) => void
}

/**
 * Root zustand store for ephemeral UI only (server state lives in React Query).
 * Theme is persisted to localStorage and reflected onto <html data-theme>.
 */
export const useUiStore = create<UiState>((set, get) => ({
  modalStack: [],
  openModal: (id) => set((s) => ({ modalStack: [...s.modalStack, id] })),
  closeModal: (id) =>
    set((s) => ({
      modalStack: id ? s.modalStack.filter((m) => m !== id) : s.modalStack.slice(0, -1),
    })),
  isModalOpen: (id) => get().modalStack.includes(id),

  lightbox: null,
  openLightbox: (state) => set({ lightbox: state }),
  closeLightbox: () => set({ lightbox: null }),

  theme: readTheme(),
  setTheme: (theme) => {
    applyTheme(theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage may be unavailable; the attribute is still set */
    }
    set({ theme })
  },
}))

// Ensure the persisted theme is applied at module load (belt-and-braces with
// the inline pre-paint script in index.html).
applyTheme(readTheme())
