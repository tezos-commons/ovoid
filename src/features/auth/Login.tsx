import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/api/agent'
import { Avatar, Button, Spinner } from '@/components'
import { useLogin } from './use-login'
import { ACCESS_LIST_URL } from './use-beta-access'
import { getLastAccount } from './last-account'
import './auth.css'

/* Where to send the user after a successful sign-in. RequireAuth stashes the
   attempted path in location.state.from; default to the home feed. */
type LocationState = { from?: string } | null

function usePreLoginPath(): string {
  const location = useLocation()
  const state = location.state as LocationState
  const from = state?.from
  // Never bounce back to an auth route.
  if (from && !from.startsWith('/login') && !from.startsWith('/oauth')) return from
  return '/'
}

/**
 * Sign-in: hand off to Bluesky OAuth. The closed-beta / wallet gate now runs
 * AFTER sign-in (see useOvoidAccess + the onboarding flow), so anyone with a
 * Bluesky account can authenticate here; access is decided once they're in.
 */
export default function Login() {
  const auth = useAuth()
  const pre = usePreLoginPath()
  const { submitting, error, signInOAuth, clearError } = useLogin(pre)
  // The last signed-in account (if any) pre-fills the handle so a returning user
  // just hits Continue; editing the field hides the hint (read once on mount).
  const [last] = useState(getLastAccount)
  const [handle, setHandle] = useState(last?.handle ?? '')

  // While the session restores on first paint, don't flash the form.
  if (auth.isLoading) {
    return (
      <div className="auth-callback">
        <Spinner size="lg" />
      </div>
    )
  }

  // Already signed in (e.g. navigated to /login manually) → go to the app.
  if (auth.isAuthed) {
    return <Navigate to={pre} replace />
  }

  function onHandleChange(value: string) {
    setHandle(value)
    if (error) clearError()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void signInOAuth(handle)
  }

  return (
    <div className="auth-screen">
      <main className="auth-screen__main">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand__logo" aria-hidden="true">
              <img src="/icon-512.png" alt="" width={64} height={64} />
            </div>
            <h1 className="auth-brand__title">Ovoid</h1>
            <p className="auth-brand__tagline">
              A Tezos-focused atproto client. Sign in with your Bluesky account.
            </p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {last && handle === last.handle && (
            <div className="auth-last">
              <Avatar src={last.avatar} alt="" fallback={last.handle} size="md" />
              <div className="auth-last__body">
                <span className="auth-last__label">Last signed in</span>
                <span className="auth-last__handle">@{last.handle}</span>
              </div>
            </div>
          )}

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="login-handle">
                Handle or DID
              </label>
              <input
                id="login-handle"
                className="auth-input"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                placeholder="alice.bsky.social"
                value={handle}
                disabled={submitting}
                onChange={(e) => onHandleChange(e.target.value)}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="auth-form__submit"
              loading={submitting}
              disabled={!handle.trim()}
            >
              Log in with Bluesky
            </Button>
            <p className="auth-note">
              You’ll be redirected to your provider to authorize access — no password is ever
              entered here. After signing in, you’ll connect a Tezos wallet to finish setup.
            </p>
          </form>

          <div className="auth-divider">New to Bluesky?</div>
          <p className="auth-note">
            Create an account at{' '}
            <a href="https://bsky.app" target="_blank" rel="noreferrer">
              bsky.app
            </a>
            . Ovoid is for the{' '}
            <a href={ACCESS_LIST_URL} target="_blank" rel="noreferrer">
              Tezos community
            </a>
            , so you’ll link a Tezos wallet once you’re in.
          </p>
        </div>
      </main>

      <footer className="auth-footer">
        <a href="https://bsky.social/about/support/privacy-policy" target="_blank" rel="noreferrer">
          Privacy
        </a>
        <a href="https://bsky.social/about/support/tos" target="_blank" rel="noreferrer">
          Terms
        </a>
        <a href="https://bsky.app/support" target="_blank" rel="noreferrer">
          Help
        </a>
      </footer>
    </div>
  )
}
