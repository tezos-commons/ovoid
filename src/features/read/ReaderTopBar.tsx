import { Link, useLocation } from 'react-router-dom'
import { HomeIcon } from '@/components/Icon'
import { useAuth } from '@/lib/api/agent'
import { useReaderPrefs } from './reader-prefs'

/**
 * Top bar shared by the reader and publication pages. Wordmark left; a centered
 * Home icon when signed in; right side holds the Log in button (signed out) and,
 * on mobile, the reading-settings ("Aa") button — on desktop that lives in the
 * bottom-left FAB instead. On mobile the bar takes the app's liquid-glass look.
 */
export function ReaderTopBar() {
  const { isLoading, isAuthed } = useAuth()
  const location = useLocation()
  const openSettings = useReaderPrefs((s) => s.openSettings)

  return (
    <header className="rdr-topbar">
      <Link to="/" className="rdr-wordmark">
        Ovoid
      </Link>
      {!isLoading && isAuthed && (
        <Link to="/" className="rdr-home" aria-label="Home">
          <HomeIcon />
        </Link>
      )}
      <div className="rdr-topbar__right">
        {!isLoading && !isAuthed && (
          <Link
            to="/login"
            state={{ from: location.pathname + location.search }}
            className="rdr-login"
          >
            Log in
          </Link>
        )}
        <button
          type="button"
          className="rdr-topbar__settings"
          aria-label="Reading settings"
          onClick={openSettings}
        >
          Aa
        </button>
      </div>
    </header>
  )
}
