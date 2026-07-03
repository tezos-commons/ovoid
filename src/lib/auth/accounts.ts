/**
 * Registry of accounts signed into on this device, persisted to localStorage.
 * Metadata ONLY — did + public profile hints for the switcher UI. Tokens live
 * in the OAuth client's IndexedDB store (one session per DID); this list is
 * the source of truth for *which* DIDs the switcher offers. Dropping an entry
 * without revoking merely orphans a session in the client store (harmless).
 *
 * `activeDid` tracks which registered account the app last ran as, so a boot
 * that resolves a *different* DID (the add-account OAuth callback) knows the
 * persisted caches belong to another viewer and must be purged.
 */

const LIST_KEY = 'ovoid:accounts'
const ACTIVE_KEY = 'ovoid:activeDid'

export interface StoredAccount {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

export function getAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(LIST_KEY)
    if (!raw) return []
    const v: unknown = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v.filter(
      (a): a is StoredAccount =>
        !!a && typeof a.did === 'string' && typeof a.handle === 'string',
    )
  } catch {
    /* malformed or storage blocked — registry degrades to this session only */
    return []
  }
}

function write(list: StoredAccount[]): StoredAccount[] {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable; callers still get the in-memory list */
  }
  return list
}

/**
 * Insert or merge an account, preserving insertion order so switcher positions
 * stay stable. Merge keeps existing fields when the incoming value is absent,
 * and keeps an existing real handle when the incoming one is still the DID
 * seed (auth-context seeds handle=did until the profile hydrates).
 */
export function upsertAccount(acc: StoredAccount): StoredAccount[] {
  const list = getAccounts()
  const i = list.findIndex((a) => a.did === acc.did)
  if (i === -1) return write([...list, acc])
  const prev = list[i]
  const next = list.slice()
  next[i] = {
    did: acc.did,
    handle: acc.handle !== acc.did ? acc.handle : prev.handle,
    displayName: acc.displayName ?? prev.displayName,
    avatar: acc.avatar ?? prev.avatar,
  }
  return write(next)
}

export function removeAccount(did: string): StoredAccount[] {
  return write(getAccounts().filter((a) => a.did !== did))
}

export function getActiveDid(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveDid(did: string | null): void {
  try {
    if (did) localStorage.setItem(ACTIVE_KEY, did)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* ignore */
  }
}
