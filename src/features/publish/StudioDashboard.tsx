import { NavLink, Link, Routes, Route, useParams, useNavigate } from 'react-router-dom'
import { Img, Spinner, EmptyState, Menu } from '@/components'
import { blobUrl } from '@/lib/api/repo-read'
import { usePublications } from './use-publications'
import { usePublicationStudio } from './use-documents'
import StudioPosts from './StudioPosts'
import StudioSettings from './StudioSettings'
import './studio.css'

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}
function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  )
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

/**
 * Publishing studio — a full-viewport surface (rendered OUTSIDE the app shell)
 * with its own sidebar: publication switcher, Posts + Settings panes, and a
 * "New post" action. The editor is a separate full-screen route.
 */
export default function StudioDashboard() {
  const { subdomain } = useParams<{ subdomain: string }>()
  const navigate = useNavigate()
  const studio = usePublicationStudio(subdomain)
  const allPubs = usePublications().data ?? []
  const rec = studio.record.data
  const icon = rec?.record.icon ? blobUrl(rec.pds, rec.did, rec.record.icon.ref.$link) : undefined
  const name = rec?.record.name || subdomain || 'Publication'

  if (studio.notFound) {
    return (
      <div className="studio-app studio-app--center">
        <EmptyState
          title="Publication not found"
          message="It may have been deleted, or isn’t yours."
          action={<Link to="/" className="btn btn--secondary btn--sm">Back to Ovoid</Link>}
        />
      </div>
    )
  }

  return (
    <div className="studio-app">
      <aside className="studio-side">
        <Link to="/" className="studio-side__back">
          <BackIcon /> Ovoid
        </Link>

        <Menu
          trigger={
            <button type="button" className="studio-pubhead">
              {icon ? (
                <span className="studio-pubhead__icon"><Img src={icon} alt="" /></span>
              ) : (
                <span className="studio-pubhead__icon studio-pubhead__icon--empty" />
              )}
              <span className="studio-pubhead__text">
                <span className="studio-pubhead__name">{name}</span>
                <span className="studio-pubhead__sub">{subdomain}.ovoid.at</span>
              </span>
            </button>
          }
          items={allPubs.map((p) => ({
            key: p.subdomain,
            label: `${p.subdomain}.ovoid.at`,
            active: p.subdomain === subdomain,
            onSelect: () => navigate(`/studio/${p.subdomain}`),
          }))}
        />

        <nav className="studio-nav">
          <NavLink end to={`/studio/${subdomain}`} className={({ isActive }) => `studio-nav__item${isActive ? ' is-active' : ''}`}>
            <DocIcon /> Posts
          </NavLink>
          <NavLink to={`/studio/${subdomain}/settings`} className={({ isActive }) => `studio-nav__item${isActive ? ' is-active' : ''}`}>
            <GearIcon /> Settings
          </NavLink>
        </nav>

        <Link to={`/studio/${subdomain}/new`} className="btn btn--primary btn--md studio-side__new">
          New post
        </Link>
      </aside>

      <main className="studio-main">
        {studio.isPending ? (
          <div className="studio-loading"><Spinner size="lg" /></div>
        ) : (
          <Routes>
            <Route index element={<StudioPosts />} />
            <Route path="settings" element={<StudioSettings />} />
          </Routes>
        )}
      </main>
    </div>
  )
}
