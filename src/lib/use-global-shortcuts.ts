import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/api/agent'
import { useComposer } from '@/store/compose-store'
import { useCommandStore } from '@/store/command-store'
import { isOverlayOpen, isTypingTarget } from './keyboard'

/** "go to" chord targets: `g` then one of these jumps to the destination. */
const GOTO: Record<string, string> = {
  h: '/',
  s: '/search',
  n: '/notifications',
  m: '/messages',
  f: '/feeds',
  l: '/lists',
  b: '/saved',
}

/**
 * App-wide keyboard shortcuts, mounted once in RootLayout:
 *  - ⌘K / Ctrl+K opens the command palette (works even while typing).
 *  - ? opens the shortcuts cheat sheet.
 *  - n starts a new post.
 *  - g then h/s/n/m/f/l/b/p jumps to that section (a "go to" chord).
 *
 * Single-key shortcuts defer while a text field is focused or an overlay is open;
 * the chord state auto-expires so a stray `g` never swallows the next keystroke.
 * Feed j/k/o/l/r live in InfiniteList, next to the virtualizer they drive.
 */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate()
  const { openCompose } = useComposer()
  const { did } = useAuth()
  const openPalette = useCommandStore((s) => s.openPalette)
  const openShortcuts = useCommandStore((s) => s.openShortcuts)

  useEffect(() => {
    let chord = false
    let chordTimer: ReturnType<typeof setTimeout> | undefined
    const endChord = () => {
      chord = false
      if (chordTimer) clearTimeout(chordTimer)
    }

    const onKey = (e: KeyboardEvent) => {
      // Command palette: global, even mid-typing — it's how you escape to it.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        openPalette()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(document.activeElement) || isOverlayOpen()) return

      if (chord) {
        endChord()
        const key = e.key.toLowerCase()
        const dest = key === 'p' ? (did ? `/profile/${did}` : '/login') : GOTO[key]
        if (dest) {
          e.preventDefault()
          navigate(dest)
        }
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        openShortcuts()
        return
      }
      if (e.key === 'n') {
        e.preventDefault()
        openCompose()
        return
      }
      if (e.key === 'g') {
        chord = true
        chordTimer = setTimeout(endChord, 1200)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      endChord()
    }
  }, [navigate, openCompose, openPalette, openShortcuts, did])
}
