import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '@/components'
import { useOvoidAccess } from '@/features/auth/use-ovoid-access'

/**
 * Access boundary (sits inside RequireAuth — assumes a session). A signed-in
 * user who is neither on the beta list nor has a linked wallet is redirected to
 * the wallet-connect onboarding. While the access check resolves we show a
 * spinner so a user who DOES have access never flashes the onboarding screen.
 */
export function RequireAccess({ children }: { children: ReactNode }) {
  const { isLoading, hasAccess } = useOvoidAccess()

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (!hasAccess) return <Navigate to="/onboarding" replace />

  return <>{children}</>
}
