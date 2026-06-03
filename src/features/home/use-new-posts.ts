import { useEffect, useRef, useState } from 'react'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import type { HomeTab } from './use-pinned-feeds'

const POLL_MS = 30_000
const PEEK_LIMIT = 30

/**
 * Detect fresh posts at the head of the active feed for the "new posts" pill.
 *
 * Mechanism: on an interval we peek the feed head (a fresh, cursorless page)
 * WITHOUT writing it into the React Query cache, then count how many of the
 * peeked URIs precede the currently-rendered top post. That count is the pill
 * number. Clicking the pill is handled by the caller (refetch + scroll-to-top),
 * after which it resets to 0.
 *
 * We never mutate the feed cache here — peeking is side-effect free so the
 * virtualizer's scroll offset is untouched until the user opts in.
 */
export function useNewPosts(
  tab: HomeTab | undefined,
  topUri: string | undefined,
  enabled: boolean,
) {
  const { agent } = useAgent()
  const [count, setCount] = useState(0)
  const topRef = useRef(topUri)
  topRef.current = topUri

  useEffect(() => {
    // Reset whenever the active tab changes or the rendered top advances.
    setCount(0)
  }, [tab?.key, topUri])

  useEffect(() => {
    if (!enabled || !tab) return
    let cancelled = false

    const peek = async (): Promise<AppBskyFeedDefs.FeedViewPost[]> => {
      if (tab.kind === 'following') {
        const r = await agent.app.bsky.feed.getTimeline({ limit: PEEK_LIMIT })
        return r.data.feed
      }
      if (tab.kind === 'feed' || tab.kind === 'list') {
        const r = await agent.app.bsky.feed.getFeed({ feed: tab.value, limit: PEEK_LIMIT })
        return r.data.feed
      }
      return []
    }

    const tick = async () => {
      try {
        const feed = await peek()
        if (cancelled) return
        const top = topRef.current
        if (!top) {
          setCount(0)
          return
        }
        const idx = feed.findIndex((it) => it.post.uri === top)
        // idx === -1 -> top scrolled past the peek window; treat as "many".
        setCount(idx === -1 ? feed.length : idx)
      } catch {
        /* transient network error — keep prior count */
      }
    }

    const id = window.setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [agent, tab, enabled])

  return { newItemsCount: count, reset: () => setCount(0) }
}
