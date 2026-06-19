import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient, gcPersistedQueries } from '@/lib/query-client'
import { runWhenIdle } from '@/lib/idle'
import { AuthProvider } from '@/lib/api/agent'
import { useSettingsSync } from '@/features/settings/use-settings-sync'
import { router } from '@/routes/router'

/**
 * Drives settings sync at the top of the tree (inside AuthProvider) rather than
 * in the app shell, so edits made on the public reader pages — which render
 * outside the shell — still write through to data.ovoid.at.
 */
function SettingsSync() {
  useSettingsSync()
  return null
}

export function App() {
  // Sweep expired persisted queries once per session, after first paint.
  useEffect(() => runWhenIdle(() => void gcPersistedQueries()), [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsSync />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
