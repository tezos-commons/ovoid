import { Dialog } from './Dialog'
import { useCommandStore } from '@/store/command-store'
import './cmdk.css'

interface Shortcut {
  keys: string[]
  label: string
}
interface Group {
  title: string
  items: Shortcut[]
}

const GROUPS: Group[] = [
  {
    title: 'Global',
    items: [
      { keys: ['⌘', 'K'], label: 'Command palette' },
      { keys: ['?'], label: 'This help' },
      { keys: ['n'], label: 'New post' },
      { keys: ['g', 'h'], label: 'Go to Home' },
      { keys: ['g', 's'], label: 'Go to Search' },
      { keys: ['g', 'n'], label: 'Go to Notifications' },
      { keys: ['g', 'm'], label: 'Go to Messages' },
      { keys: ['g', 'f'], label: 'Go to Feeds' },
      { keys: ['g', 'l'], label: 'Go to Lists' },
      { keys: ['g', 'b'], label: 'Go to Saved' },
      { keys: ['g', 'p'], label: 'Go to Profile' },
    ],
  },
  {
    title: 'Feed',
    items: [
      { keys: ['j'], label: 'Next post' },
      { keys: ['k'], label: 'Previous post' },
      { keys: ['o'], label: 'Open post' },
      { keys: ['l'], label: 'Like' },
      { keys: ['r'], label: 'Reply' },
    ],
  },
  {
    title: 'Compose',
    items: [{ keys: ['⌘', '↵'], label: 'Post' }],
  },
  {
    title: 'General',
    items: [{ keys: ['Esc'], label: 'Back / close' }],
  },
]

/** Keyboard-shortcuts cheat sheet, opened by `?` or the palette. The single source
 *  of truth for what's documented; the actual bindings live in
 *  use-global-shortcuts (global) and InfiniteList (feed j/k/o/l/r). */
export function ShortcutsDialog() {
  const open = useCommandStore((s) => s.shortcuts)
  const close = useCommandStore((s) => s.close)
  if (!open) return null

  return (
    <Dialog open={open} onClose={close} title="Keyboard shortcuts" sheetOnMobile>
      <div className="shortcuts">
        {GROUPS.map((g) => (
          <section key={g.title} className="shortcuts__group">
            <h3 className="shortcuts__title">{g.title}</h3>
            {g.items.map((s) => (
              <div key={s.label} className="shortcuts__row">
                <span className="shortcuts__label">{s.label}</span>
                <span className="shortcuts__keys">
                  {s.keys.map((k, i) => (
                    <kbd key={i} className="shortcuts__kbd">
                      {k}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  )
}
