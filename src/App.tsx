import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient, gcPersistedQueries } from '@/lib/query-client'
import { runWhenIdle } from '@/lib/idle'
import { AuthProvider } from '@/lib/api/agent'
import { router } from '@/routes/router'

export function App() {
  // Sweep expired persisted queries once per session, after first paint.
  useEffect(() => runWhenIdle(() => void gcPersistedQueries()), [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
