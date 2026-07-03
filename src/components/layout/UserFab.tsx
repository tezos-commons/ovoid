import { useState } from 'react'
import clsx from 'clsx'
import { Avatar } from '../Avatar'
import { PlusIcon } from '../Icon'
import { useAuth } from '@/lib/api/agent'
import { AccountSheet } from '@/features/auth/AccountSheet'

/**
 * The account switcher, pinned to the bottom-left of the page (desktop only;
 * mobile manages accounts via the profile tab's long-press). One avatar per
 * registered account: clicking another account switches to it, clicking the
 * active one opens the management sheet (sign out / remove), and the + button
 * opens the add-account flow.
 */
export function UserFab() {
  const { isAuthed, did, handle, displayName, avatar, accounts, switchAccount } = useAuth()
  const [sheet, setSheet] = useState<'list' | 'add' | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  if (!isAuthed) return null

  // The registry normally contains the active account; if storage is blocked
  // (private mode) it can be empty, so fall back to the live session.
  const list = accounts.some((a) => a.did === did)
    ? accounts
    : [{ did: did!, handle: handle ?? did!, displayName, avatar }, ...accounts]

  const onSwitch = async (target: string) => {
    if (switching) return
    setSwitching(target)
    try {
      await switchAccount(target)
    } catch {
      // Dead session — it was dropped from the registry; surface the sheet so
      // the user can re-add it.
      setSheet('list')
    } finally {
      setSwitching(null)
    }
  }

  return (
    <>
      <div className="user-fab-stack">
        <button
          type="button"
          className="user-fab user-fab--add"
          title="Add account"
          aria-label="Add account"
          onClick={() => setSheet('add')}
        >
          <PlusIcon size={16} />
        </button>
        {list.map((acc) => {
          const active = acc.did === did
          return (
            <button
              key={acc.did}
              type="button"
              className={clsx('user-fab', active && 'user-fab--active')}
              title={active ? `@${acc.handle} — manage accounts` : `Switch to @${acc.handle}`}
              aria-label={active ? `@${acc.handle} — manage accounts` : `Switch to @${acc.handle}`}
              aria-current={active || undefined}
              disabled={switching !== null}
              onClick={() => (active ? setSheet('list') : void onSwitch(acc.did))}
            >
              <Avatar
                size={active ? 'md' : 'sm'}
                src={active ? (avatar ?? acc.avatar) : acc.avatar}
                alt={acc.handle}
                fallback={acc.displayName || acc.handle}
              />
            </button>
          )
        })}
      </div>
      <AccountSheet
        open={sheet !== null}
        initialMode={sheet ?? 'list'}
        onClose={() => setSheet(null)}
      />
    </>
  )
}
