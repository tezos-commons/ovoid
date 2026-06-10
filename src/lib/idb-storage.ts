import type { AsyncStorage, PersistedQuery } from '@tanstack/query-persist-client-core'

/**
 * Minimal IndexedDB key-value store backing the per-query persister.
 *
 * Values are stored as structured clones of the PersistedQuery object — no
 * JSON round-trip. That's both cheaper and more faithful: query data may hold
 * a Map (profilesBulk), which JSON.stringify would silently flatten to {}.
 *
 * Every operation is best-effort: persistence must never break the app, so
 * failures (quota, private-mode IDB bans, clone errors) resolve as misses or
 * no-ops rather than rejecting into the query layer.
 */

const DB_NAME = 'ovoid-query-cache'
const STORE = 'queries'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    // A failed open must not poison every later call with the same rejection.
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const idbStorage: AsyncStorage<PersistedQuery> = {
  getItem: (key) =>
    withStore('readonly', (s) => s.get(key) as IDBRequest<PersistedQuery | undefined>).catch(
      () => null,
    ),
  setItem: (key, value) => withStore('readwrite', (s) => s.put(value, key)).catch(() => {}),
  removeItem: (key) =>
    withStore('readwrite', (s) => s.delete(key)).then(
      () => undefined,
      () => undefined,
    ),
  // Used by persisterGc to find expired/busted entries.
  entries: async () => {
    try {
      const db = await openDb()
      return await new Promise<Array<[string, PersistedQuery]>>((resolve, reject) => {
        const t = db.transaction(STORE, 'readonly')
        const s = t.objectStore(STORE)
        const keysReq = s.getAllKeys()
        const valsReq = s.getAll()
        t.oncomplete = () =>
          resolve(keysReq.result.map((k, i) => [String(k), valsReq.result[i] as PersistedQuery]))
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      })
    } catch {
      return []
    }
  },
}

/** Drop every persisted query (sign-out: disk must not outlive the session). */
export function clearIdbStorage(): Promise<void> {
  return withStore('readwrite', (s) => s.clear()).then(
    () => undefined,
    () => undefined,
  )
}
