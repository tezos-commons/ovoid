import { Link, useLocation } from 'react-router-dom'
import { ScreenHeader } from '@/components/layout'
import { HomeIcon, SearchIcon } from '@/components/Icon'
import '@/features/routes/notFound.css'

/**
 * 404 fallback for the `*` catch-all inside RootLayout.
 *
 * Rendered as a child of the `/` shell route, so it inherits the 600px center
 * column, the nav rails, and the global compose modal. We only own the column
 * body: a sticky ScreenHeader plus a centered empty state.
 */
export default function NotFound() {
  // Surface the path the user actually hit. Read-only; never used to route.
  const { pathname } = useLocation()

  return (
    <>
      <ScreenHeader title="Not found" showBack />
      <div className="notfound">
        <div className="notfound__code" aria-hidden="true">
          404
        </div>
        <h1 className="notfound__title">This page doesn’t exist</h1>
        <p className="notfound__msg">
          The page you’re looking for may have been moved, deleted, or never
          existed. Check the address or head back to your timeline.
        </p>
        {pathname && pathname !== '/' && (
          <code className="notfound__path" title="Requested path">
            {pathname}
          </code>
        )}
        <div className="notfound__actions">
          <Link to="/" className="notfound__btn notfound__btn--primary">
            <HomeIcon size={18} />
            Go home
          </Link>
          <Link to="/search" className="notfound__btn notfound__btn--secondary">
            <SearchIcon size={18} />
            Search
          </Link>
        </div>
      </div>
    </>
  )
}
