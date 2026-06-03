import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/api/agent'
import { bootstrap } from '@/lib/auth-bootstrap'
import { Spinner } from '@/components'
import './auth.css'

/**
 * OAuth redirect target (/oauth/callback). The actual code exchange happens
 * inside the AuthProvider's one-shot init() (via bootstrap()), which reads the
 * callback params straight off window.location — there is no manual parsing to
 * do here. This screen's only jobs are:
 *
 *   1. show a spinner while init() resolves;
 *   2. once a session exists, read the round-tripped `state` (the pre-login
 *      path passed to signIn) and navigate there;
 *   3. history.replaceState to strip the ?code=…&state=… query so a reload or
 *      a shared URL doesn't re-trigger an (already consumed) exchange.
 *
 * bootstrap() is memoized, so calling it here observes the SAME init() the
 * provider awaited — it never double-consumes the callback. We await it only
 * to obtain `state`, which the AuthContext does not surface.
 *
 * Invariant: we navigate exactly once, after auth resolves, regardless of how
 * many times this effect runs (StrictMode double-invoke safe via the ref).
 */
export default function Callback() {
  const { isLoading, isAuthed } = useAuth()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const navigated = useRef(false)

  useEffect(() => {
    if (navigated.current) return

    let cancelled = false
    bootstrap()
      .then((result) => {
        if (cancelled || navigated.current) return

        // Strip OAuth params from the URL before routing away, so the address
        // bar / history entry is clean and reloads can't re-enter the exchange.
        if (window.location.search || window.location.hash) {
          window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname,
          )
        }

        const dest =
          result?.session && typeof result.state === 'string' && result.state
            ? result.state
            : '/'

        if (result?.session) {
          navigated.current = true
          navigate(dest, { replace: true })
        } else {
          // init() ran but produced no session: the callback was invalid,
          // already consumed, or the user reached this route directly.
          setFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  // If the provider resolved a session through its own init() path before our
  // effect navigated (e.g. a restored session), honor it immediately.
  useEffect(() => {
    if (!navigated.current && !isLoading && isAuthed) {
      navigated.current = true
      navigate('/', { replace: true })
    }
  }, [isLoading, isAuthed, navigate])

  if (failed) {
    return (
      <div className="auth-callback">
        <div className="auth-callback__inner">
          <div className="auth-callback__title">Couldn't complete sign-in</div>
          <div className="auth-callback__sub">
            The sign-in link was invalid or has expired.
          </div>
          <button
            type="button"
            className="auth-modeswitch__btn auth-modeswitch__btn--active"
            style={{ flex: '0 0 auto', padding: '8px 20px' }}
            onClick={() => navigate('/login', { replace: true })}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-callback">
      <div className="auth-callback__inner">
        <Spinner size="lg" />
        <div className="auth-callback__title">Signing you in…</div>
        <div className="auth-callback__sub">Completing authorization</div>
      </div>
    </div>
  )
}
