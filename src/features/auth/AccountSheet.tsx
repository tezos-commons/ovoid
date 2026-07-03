import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { useLocation } from 'react-router-dom'
import { Avatar, Button, IconButton, ModalSheet, Spinner } from '@/components'
import { CloseIcon, PlusIcon } from '@/components/Icon'
import { useAuth } from '@/lib/api/agent'
import { useLogin } from './use-login'
import { HandleSuggest } from './HandleSuggest'
import './auth.css'

export interface AccountSheetProps {
  open: boolean
  onClose: () => void
  /** Open directly on the add-account form (the desktop + button). */
  initialMode?: 'list' | 'add'
}

/**
 * Account management sheet, shared by the desktop avatar stack and the mobile
 * profile-tab long-press: switch between registered accounts, remove one, sign
 * out of the current one, or start the add-account OAuth flow.
 *
 * Adding an account is a full-page OAuth redirect (the current session stays
 * persisted in the client's store); the round-tripped `state` returns the user
 * to the path they were on, now signed into the new account.
 */
export function AccountSheet({ open, onClose, initialMode = 'list' }: AccountSheetProps) {
  return (
    <ModalSheet open={open} onClose={onClose} title="Accounts">
      {/* Keyed remount per open so view/form state resets each time. */}
      {open && <SheetBody initialMode={initialMode} onClose={onClose} />}
    </ModalSheet>
  )
}

function SheetBody({ initialMode, onClose }: { initialMode: 'list' | 'add'; onClose: () => void }) {
  const { did, handle, accounts, switchAccount, removeAccount, signOut } = useAuth()
  const location = useLocation()
  const [view, setView] = useState(initialMode)
  const [switching, setSwitching] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const onPick = async (target: string) => {
    if (switching || target === did) return
    setSwitching(target)
    setSwitchError(null)
    try {
      await switchAccount(target)
      onClose()
    } catch {
      // switchAccount already dropped the dead account from the registry.
      setSwitching(null)
      setSwitchError('That session has expired — add the account again to sign in.')
    }
  }

  if (view === 'add') {
    return (
      <AddAccountForm
        returnTo={location.pathname + location.search}
        onBack={accounts.length > 0 ? () => setView('list') : undefined}
      />
    )
  }

  return (
    <div className="acct-sheet">
      {switchError && (
        <div className="auth-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{switchError}</span>
        </div>
      )}

      <div className="acct-list">
        {accounts.map((acc) => {
          const active = acc.did === did
          return (
            <div key={acc.did} className={clsx('acct-row', active && 'acct-row--active')}>
              <button
                type="button"
                className="acct-row__main"
                disabled={active || switching !== null}
                onClick={() => void onPick(acc.did)}
              >
                <Avatar size="sm" src={acc.avatar} alt={acc.handle} fallback={acc.displayName || acc.handle} />
                <span className="acct-row__names">
                  <span className="acct-row__name">{acc.displayName || acc.handle}</span>
                  <span className="acct-row__handle">@{acc.handle}</span>
                </span>
                <span className="acct-row__state">
                  {active ? <CheckGlyph /> : switching === acc.did ? <Spinner size="sm" /> : null}
                </span>
              </button>
              {!active && (
                <IconButton
                  label={`Remove @${acc.handle}`}
                  className="acct-row__remove"
                  disabled={switching !== null}
                  onClick={() => void removeAccount(acc.did)}
                >
                  <CloseIcon size={16} />
                </IconButton>
              )}
            </div>
          )
        })}
      </div>

      <div className="acct-actions">
        <Button
          variant="secondary"
          icon={<PlusIcon size={16} />}
          disabled={switching !== null}
          onClick={() => setView('add')}
        >
          Add account
        </Button>
        <Button
          variant="ghost"
          disabled={switching !== null}
          onClick={() => {
            void signOut()
            onClose()
          }}
        >
          Sign out {handle ? `@${handle}` : ''}
        </Button>
      </div>
    </div>
  )
}

function AddAccountForm({ returnTo, onBack }: { returnTo: string; onBack?: () => void }) {
  const { submitting, error, signInOAuth, clearError } = useLogin(returnTo)
  const [handle, setHandle] = useState('')
  // Collapse the suggestion list once a row was picked; typing reopens it.
  const [picked, setPicked] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void signInOAuth(handle)
  }

  return (
    <form className="acct-add" onSubmit={onSubmit} noValidate>
      <p className="acct-add__note">
        You’ll be redirected to the account’s provider to authorize Ovoid, then return here
        signed into it. Your current account stays available in the switcher.
      </p>

      {error && (
        <div className="auth-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <input
        className="auth-input"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="email"
        placeholder="alice.bsky.social"
        aria-label="Handle or DID"
        value={handle}
        disabled={submitting}
        onChange={(e) => {
          setHandle(e.target.value)
          setPicked(false)
          if (error) clearError()
        }}
      />

      {!picked && !submitting && (
        <HandleSuggest
          query={handle}
          onPick={(h) => {
            setHandle(h)
            setPicked(true)
          }}
        />
      )}

      <div className="acct-add__actions">
        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
            Back
          </Button>
        )}
        <Button type="submit" variant="primary" loading={submitting} disabled={!handle.trim()}>
          Continue
        </Button>
      </div>
    </form>
  )
}

/** Small check mark on the active row (no CheckIcon in the shared set). */
function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}
