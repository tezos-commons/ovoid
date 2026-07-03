// Must run before anything else so Sentry instruments errors from the first tick.
import './instrument'

// beforeinstallprompt fires once, early — the capture must live in the entry
// chunk, not a lazy route (see lib/install.ts).
import '@/lib/install'

// Applies the persisted font scale/family at module load. Must be in the entry
// chunk: its only other importer is the lazy appearance-settings route, so
// without this the saved appearance wouldn't apply until that screen is opened.
import '@/features/settings/theme-store'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import '@/styles'
import '@/components/components.css'
import '@/components/layout/layout.css'
import { App } from './App'
import { getActiveDid } from '@/lib/auth/accounts'

// The app owns scroll restoration (RootLayout resets on forward nav; InfiniteList
// restores virtualized feeds on back). Turn off the browser's own restoration so
// it doesn't race ours — with 'auto' the browser re-applies a remembered offset
// after our restore, which reads as "lands then jumps to top" on back.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// atproto's OAuth loopback client forbids the "localhost" hostname in
// redirect_uris (RFC 8252 §8.3) — only the loopback IP literal is permitted.
// The dev origin is the single source of truth for both the synthesized
// client_id's redirect_uri AND the page the PDS redirects the callback back to
// (PKCE/DPoP state lives in per-origin IndexedDB, so those two MUST share one
// origin). If the server was reached at http://localhost:5173, bounce to the
// equivalent 127.0.0.1 origin — the interface vite actually binds (see
// vite.config.ts) — before anything reads window.location. This runs once,
// pre-render, so getOAuthClient() always sees an IP-based origin.
if (import.meta.env.DEV && window.location.hostname === 'localhost') {
  const url = new URL(window.location.href)
  url.hostname = '127.0.0.1'
  window.location.replace(url.toString())
}

// NOTE: the OAuth one-shot init (bootstrap()) is owned by <AuthProvider>, which
// invokes it exactly once on mount. oauthClient.init() must not run twice, so
// we deliberately do NOT call it here — rendering <App/> drives it.
else {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('#root element missing from index.html')

  createRoot(rootEl).render(
    <StrictMode>
      <Sentry.ErrorBoundary fallback={<AppCrash />} showDialog>
        <App />
      </Sentry.ErrorBoundary>
    </StrictMode>,
  )

  // Fetch the landing route's lazy chunk in parallel with the OAuth session
  // restore instead of serialized after it: a registered account means
  // RequireAuth resolves '/' into HomeScreen; with none, '/' redirects to
  // /login. Same import specifiers as router.tsx, so Rollup reuses the chunks.
  if (getActiveDid()) {
    void import('@/features/home/HomeScreen').catch(() => {})
  } else if (window.location.pathname === '/') {
    void import('@/features/auth/Login').catch(() => {})
  }

  // Register the service worker so Ovoid is installable (add-to-home-screen) and
  // opens offline as an app shell. The SW is passthrough except for a navigation
  // fallback, so it's safe alongside dev HMR.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

/** Last-resort fallback shown by the Sentry error boundary on an uncaught render error. */
function AppCrash() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>The error was reported. Try reloading.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-contrast-25)', color: 'inherit', cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    </div>
  )
}
