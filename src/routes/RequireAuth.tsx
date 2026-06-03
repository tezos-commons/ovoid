import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/api/agent'
import { Spinner } from '@/components'

/**
 * Auth boundary for protected routes. While the OAuth session restores we show
 * a spinner (never flash the login page on reload); once resolved, signed-out
 * users are redirected to /login with the attempted path preserved in state so
 * the callback can return them there.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthed } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthed) {
    const next = location.pathname + location.search
    return <Navigate to="/login" replace state={{ from: next }} />
  }

  return <>{children}</>
}
