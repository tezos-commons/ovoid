import { useEffect, useState } from 'react'
import { useRouteError } from 'react-router-dom'
import * as Sentry from '@sentry/react'

// Don't reload more than once per window: if the page errors again immediately
// after a reload, the error is deterministic (a real bug, not a stale chunk), so
// reloading again would loop — show the fallback instead.
const RELOAD_KEY = 'ovoid:route-error-reload-at'
const RELOAD_WINDOW_MS = 10_000

/**
 * Route-level error element. React-router's data router catches errors thrown by
 * a route (most commonly a lazy chunk that 404s after a deploy) before they can
 * reach the app-wide Sentry boundary, and renders its own "💿 Hey developer"
 * screen. We replace that: report the error, then trigger a hard reload to pull
 * fresh chunks — the fix for the stale-chunk case — guarding against a reload
 * loop for genuinely broken routes.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const [looping, setLooping] = useState(false)

  useEffect(() => {
    Sentry.captureException(error)
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) {
      setLooping(true)
      return
    }
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    window.location.reload()
  }, [error])

  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100dvh',
        padding: 24,
        textAlign: 'center',
        gap: 12,
      }}
    >
      <div>
        {looping ? (
          <>
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Reloading didn’t help. The error was reported.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem(RELOAD_KEY)
                window.location.reload()
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'var(--bg-contrast-25)',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Reloading…</p>
        )}
      </div>
    </div>
  )
}
