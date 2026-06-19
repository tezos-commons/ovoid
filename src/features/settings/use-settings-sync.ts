import { useEffect } from 'react'
import { useAgent } from '@/lib/api/agent'
import { reconcileSettings, startWriteThrough } from './settings-sync'

/**
 * Drives cross-device settings sync from React. Mounted once in the app shell.
 * On sign-in it reconciles the local settings against the server, then keeps the
 * server copy current via write-through. On sign-out (or account switch) the
 * effect tears down and the next signed-in identity re-reconciles. The sync is
 * silent — no UI surfaces its state.
 */
export function useSettingsSync() {
  const { agent, did, isAuthed } = useAgent()

  useEffect(() => {
    if (!isAuthed || !did) return
    let cancelled = false
    let stop: (() => void) | undefined

    reconcileSettings(agent, did)
      .catch(() => {
        /* transient failure; write-through below still retries on the next edit */
      })
      .finally(() => {
        if (!cancelled) stop = startWriteThrough(agent, did)
      })

    return () => {
      cancelled = true
      stop?.()
    }
  }, [agent, did, isAuthed])
}
