import { useCallback, useState } from 'react'

/**
 * Client-only recent-search history, persisted in localStorage. Most-recent
 * first, capped at MAX. Re-running a query moves it back to the top (dedup is
 * case-insensitive on the trimmed text).
 */
const KEY = 'ovoid:recentSearches'
const MAX = 10

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]).filter((s) => typeof s === 'string') : []
  } catch {
    return []
  }
}

function write(items: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* quota / private mode — history is best-effort */
  }
}

/** Reactive recent-search history with add/remove/clear. */
export function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>(read)

  const add = useCallback((query: string) => {
    const q = query.trim()
    if (!q) return
    setRecents((prev) => {
      const next = [q, ...prev.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX)
      write(next)
      return next
    })
  }, [])

  const remove = useCallback((query: string) => {
    setRecents((prev) => {
      const next = prev.filter((s) => s !== query)
      write(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    write([])
    setRecents([])
  }, [])

  return { recents, add, remove, clear }
}
