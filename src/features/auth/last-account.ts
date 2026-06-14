/**
 * The last account that was signed in, persisted to localStorage so the login
 * screen can offer it back after sign-out (a lightweight account hint — no
 * tokens, just the public handle/did/avatar). Written while signed in; kept
 * across sign-out on purpose so the next visit can pre-fill it.
 */
const KEY = 'ovoid:lastAccount'

export interface LastAccount {
  did: string
  handle: string
  avatar?: string
}

export function getLastAccount(): LastAccount | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<LastAccount>
    if (v && typeof v.did === 'string' && typeof v.handle === 'string') {
      return { did: v.did, handle: v.handle, avatar: typeof v.avatar === 'string' ? v.avatar : undefined }
    }
  } catch {
    /* malformed or storage blocked */
  }
  return null
}

export function setLastAccount(acc: LastAccount): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(acc))
  } catch {
    /* storage unavailable (private mode / quota) */
  }
}

export function clearLastAccount(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
