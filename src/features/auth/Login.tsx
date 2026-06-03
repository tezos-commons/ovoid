import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/api/agent'
import { Button, Spinner } from '@/components'
import { useLogin } from './use-login'
import { useBetaAccess, ACCESS_LIST_URL } from './use-beta-access'
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

export default function Login() {
  const auth = useAuth()
  const pre = usePreLoginPath()
  const { submitting, error: loginError, signInOAuth, clearError } = useLogin(pre)
  const access = useBetaAccess()
  const [handle, setHandle] = useState('')

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

  // Editing the handle invalidates any prior access check.
  function onHandleChange(value: string) {
    setHandle(value)
    if (access.status !== 'idle') access.reset()
    if (loginError) clearError()
  }

  // Step 1: resolve the DID and test list membership.
  function onCheck(e: FormEvent) {
    e.preventDefault()
    clearError()
    void access.check(handle)
  }

  // Step 2 (allowed only): hand off to OAuth.
  function onLogin() {
    void signInOAuth(handle)
  }

  const allowed = access.status === 'allowed'
  const denied = access.status === 'denied'
  const error = loginError ?? access.error

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

          {denied && (
            <div className="auth-beta" role="status">
              <strong>Ovoid is in a closed beta.</strong>
              <span>
                Access is currently limited to{' '}
                <a href={ACCESS_LIST_URL} target="_blank" rel="noreferrer">
                  verified Tezos users on Bluesky
                </a>
                , and that account isn’t on the list yet. Try a different account
                once you’ve been verified.
              </span>
            </div>
          )}

          <form className="auth-form" onSubmit={onCheck} noValidate>
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

            {allowed ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="auth-form__submit"
                  loading={submitting}
                  onClick={onLogin}
                >
                  Log in with Bluesky
                </Button>
                <p className="auth-note">
                  You’re a verified Tezos user. You’ll be redirected to your
                  provider to authorize access — no password is ever entered here.
                </p>
              </>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="auth-form__submit"
                loading={access.status === 'checking'}
                disabled={!handle.trim() || submitting}
              >
                Continue
              </Button>
            )}
          </form>

          <div className="auth-divider">New to Bluesky?</div>
          <p className="auth-note">
            Create an account at{' '}
            <a href="https://bsky.app" target="_blank" rel="noreferrer">
              bsky.app
            </a>
            , then get verified as a Tezos user to join the beta (see the{' '}
            <a href={ACCESS_LIST_URL} target="_blank" rel="noreferrer">
              list
            </a>
            ).
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
