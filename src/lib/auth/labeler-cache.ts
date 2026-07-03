/**
 * Last-known labeler subscriptions per account, persisted so sign-in can
 * configure the agent synchronously instead of blocking the first authed
 * render on a preferences round trip. Refreshed in the background after every
 * sign-in / account switch, so it is at worst one session stale after editing
 * subscriptions from another client — and absent only on a DID's very first
 * sign-in on this device.
 */
const key = (did: string) => `ovoid:labelers:${did}`

export function getCachedLabelerDids(did: string): string[] | null {
  try {
    const raw = localStorage.getItem(key(did))
    if (!raw) return null
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : null
  } catch {
    return null
  }
}

export function setCachedLabelerDids(did: string, dids: string[]): void {
  try {
    localStorage.setItem(key(did), JSON.stringify(dids))
  } catch {
    /* storage unavailable — boot falls back to the background refresh */
  }
}
