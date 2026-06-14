import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from './Dialog'
import { NAV_ITEMS } from './layout/navItems'
import { PencilIcon, SearchIcon } from './Icon'
import { useAuth } from '@/lib/api/agent'
import { useComposer } from '@/store/compose-store'
import { useCommandStore } from '@/store/command-store'
import { useUiStore, type Theme } from '@/store/ui-store'
import './cmdk.css'

interface Command {
  id: string
  label: string
  /** Extra terms the fuzzy match should consider beyond the label. */
  keywords?: string
  icon?: ReactNode
  run: () => void
}

/** Case-insensitive subsequence match — every query char appears in order. */
function fuzzy(query: string, text: string): boolean {
  if (!query) return true
  const t = text.toLowerCase()
  let i = 0
  for (const ch of query.toLowerCase()) {
    i = t.indexOf(ch, i)
    if (i === -1) return false
    i++
  }
  return true
}

const THEME_CYCLE: Record<Theme, Theme> = { light: 'dim', dim: 'dark', dark: 'light' }

/**
 * ⌘K command palette: fuzzy-filtered navigation + actions. Built on Dialog (scrim,
 * Escape, scroll-lock, focus trap); Dialog auto-focuses the input on open. Arrow
 * keys move the selection, Enter runs it. Opened via the command store (the global
 * shortcut hook flips it).
 */
export function CommandPalette() {
  const open = useCommandStore((s) => s.palette)
  const close = useCommandStore((s) => s.close)
  const navigate = useNavigate()
  const { did, isAuthed } = useAuth()
  const { openCompose } = useComposer()
  const openShortcuts = useCommandStore((s) => s.openShortcuts)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => {
      close()
      navigate(to)
    }
    const nav = NAV_ITEMS.map((item) => {
      const to =
        item.authed && !isAuthed
          ? '/login'
          : item.key === 'profile' && did
            ? `/profile/${did}`
            : item.to
      return {
        id: `nav-${item.key}`,
        label: item.label,
        keywords: 'go to open',
        icon: item.icon(false),
        run: go(to),
      }
    })
    return [
      {
        id: 'new-post',
        label: 'New post',
        keywords: 'compose write tweet',
        icon: <PencilIcon size={18} />,
        run: () => {
          close()
          openCompose()
        },
      },
      ...nav,
      { id: 'saved', label: 'Saved', keywords: 'bookmarks', icon: <SearchIcon size={18} />, run: go('/saved') },
      {
        id: 'theme',
        label: `Switch theme (${theme} → ${THEME_CYCLE[theme]})`,
        keywords: 'dark light dim appearance',
        run: () => {
          setTheme(THEME_CYCLE[theme])
        },
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        keywords: 'help keys cheat sheet',
        run: () => openShortcuts(),
      },
    ]
  }, [navigate, close, did, isAuthed, openCompose, openShortcuts, theme, setTheme])

  const results = useMemo(
    () => commands.filter((c) => fuzzy(q, `${c.label} ${c.keywords ?? ''}`)),
    [commands, q],
  )

  // Reset query/selection each time the palette opens.
  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
    }
  }, [open])

  // Keep the selection in range as the result set shrinks, and scroll it in view.
  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, results.length - 1)))
  }, [results.length])
  useEffect(() => {
    listRef.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel, results])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      results[sel]?.run()
    }
  }

  return (
    <Dialog open={open} onClose={close} sheetOnMobile={false} className="cmdk">
      <div className="cmdk__search">
        <SearchIcon size={18} />
        <input
          className="cmdk__input"
          type="text"
          placeholder="Type a command or search…"
          value={q}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value)
            setSel(0)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="cmdk__list" ref={listRef}>
        {results.length === 0 && <div className="cmdk__empty">No matching commands</div>}
        {results.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className="cmdk__item"
            data-sel={i === sel}
            onMouseMove={() => setSel(i)}
            onClick={() => c.run()}
          >
            <span className="cmdk__icon">{c.icon}</span>
            <span className="cmdk__label">{c.label}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}
