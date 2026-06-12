import { useSyncExternalStore } from 'react'

/**
 * beforeinstallprompt capture. Chromium fires this once, early, and only if
 * the app isn't installed — so this module must be imported from the entry
 * chunk (main.tsx), not a lazy route, or the event is gone before we listen.
 * iOS never fires it (install is the Safari share-sheet flow; the settings
 * screen explains that path instead).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** True while the browser has an install prompt banked for us. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  )
}

/** Show the browser install dialog. The prompt is single-use. */
export async function promptInstall(): Promise<boolean> {
  const evt = deferred
  if (!evt) return false
  deferred = null
  emit()
  await evt.prompt()
  const { outcome } = await evt.userChoice
  return outcome === 'accepted'
}
