import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles'
import '@/components/components.css'
import '@/components/layout/layout.css'
import { App } from './App'

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
      <App />
    </StrictMode>,
  )

  // Register the service worker so Ovoid is installable (add-to-home-screen) and
  // opens offline as an app shell. The SW is passthrough except for a navigation
  // fallback, so it's safe alongside dev HMR.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}
