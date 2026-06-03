import { useMemo, useState, type KeyboardEvent } from 'react'
import { graphemeCount, MAX_GRAPHEMES } from '@/lib/facets'

/**
 * Shared composer text state: the post text plus its derived grapheme count and
 * limit flags. Used by both the compose modal and the inline reply composer so
 * the 300-grapheme rule lives in one place.
 */
export function useComposerText(initial = '') {
  const [text, setText] = useState(initial)
  const count = useMemo(() => graphemeCount(text), [text])
  const remaining = MAX_GRAPHEMES - count
  return {
    text,
    setText,
    count,
    remaining,
    over: remaining < 0,
    isEmptyText: text.trim().length === 0,
    max: MAX_GRAPHEMES,
  }
}

/** ⌘/Ctrl+Enter handler that triggers `submit` — the composer send convention. */
export function onComposerKeyDown(submit: () => void) {
  return (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }
}
