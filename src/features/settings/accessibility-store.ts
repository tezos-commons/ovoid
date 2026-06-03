import { create } from 'zustand'

/**
 * Accessibility & privacy toggles that are purely client-side (this client has
 * no backend; these don't map onto a server preference entry). Persisted to
 * localStorage as a single JSON blob and applied to documentElement where they
 * have a visual effect (reduce-motion sets a data attribute the stylesheet can
 * key off; the rest are read by feature code, e.g. the composer's require-alt).
 */

const KEY = 'ovoid:a11y'

export interface AccessibilityState {
  requireAltText: boolean
  autoplay: boolean
  reduceMotion: boolean
  largeAltBadges: boolean
  loggedOutVisibility: boolean
  setRequireAltText: (v: boolean) => void
  setAutoplay: (v: boolean) => void
  setReduceMotion: (v: boolean) => void
  setLargeAltBadges: (v: boolean) => void
  setLoggedOutVisibility: (v: boolean) => void
}

type Persisted = Pick<
  AccessibilityState,
  'requireAltText' | 'autoplay' | 'reduceMotion' | 'largeAltBadges' | 'loggedOutVisibility'
>

const DEFAULTS: Persisted = {
  requireAltText: false,
  autoplay: true,
  reduceMotion: false,
  largeAltBadges: false,
  loggedOutVisibility: true,
}

function read(): Persisted {
  if (typeof localStorage === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

function applyReduceMotion(on: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.toggleAttribute('data-reduce-motion', on)
}

export const useAccessibilityStore = create<AccessibilityState>((set, get) => {
  function persist(next: Partial<Persisted>) {
    const merged: Persisted = {
      requireAltText: get().requireAltText,
      autoplay: get().autoplay,
      reduceMotion: get().reduceMotion,
      largeAltBadges: get().largeAltBadges,
      loggedOutVisibility: get().loggedOutVisibility,
      ...next,
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(merged))
    } catch {
      /* storage unavailable */
    }
    set(next)
  }

  const initial = read()
  applyReduceMotion(initial.reduceMotion)

  return {
    ...initial,
    setRequireAltText: (requireAltText) => persist({ requireAltText }),
    setAutoplay: (autoplay) => persist({ autoplay }),
    setReduceMotion: (reduceMotion) => {
      applyReduceMotion(reduceMotion)
      persist({ reduceMotion })
    },
    setLargeAltBadges: (largeAltBadges) => persist({ largeAltBadges }),
    setLoggedOutVisibility: (loggedOutVisibility) => persist({ loggedOutVisibility }),
  }
})
