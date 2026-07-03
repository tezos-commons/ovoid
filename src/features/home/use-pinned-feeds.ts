import { useQuery } from '@tanstack/react-query'
import {
  AppBskyActorDefs,
  type AppBskyFeedDefs,
  type AppBskyGraphDefs,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { getPrefs } from '@/lib/prefs'

/**
 * A resolved home tab. `kind` discriminates how the timeline is sourced:
 *   - 'following'  -> getTimeline
 *   - 'feed'       -> getFeed({ feed: uri })
 *   - 'list'       -> getListFeed({ list: uri }) (getFeed does not serve lists).
 *                     Lists whose record no longer resolves are dropped below.
 *
 * `value` is the AT-URI (generator/list) or the literal "following".
 * `id` is the SavedFeed stable id (used for edit/unpin writes).
 */
export interface HomeTab {
  key: string
  label: string
  kind: 'following' | 'feed' | 'list'
  value: string
  id: string
  avatar?: string
  pinned: boolean
}

const SAVED_FEEDS_TYPE = 'app.bsky.actor.defs#savedFeedsPrefV2'

type SavedFeed = AppBskyActorDefs.SavedFeed

/** Pull the savedFeedsPrefV2 entry out of the heterogeneous prefs array. */
function readSavedFeeds(prefs: AppBskyActorDefs.Preferences): SavedFeed[] {
  for (const p of prefs) {
    if (p.$type === SAVED_FEEDS_TYPE && AppBskyActorDefs.isSavedFeedsPrefV2(p)) {
      return p.items
    }
  }
  return []
}

/**
 * The set of tabs shown in the Home feed strip:
 *   1. "Following" (always first; synthesised even if the timeline SavedFeed is
 *      absent, because Home must always offer the following feed).
 *   2. Pinned custom feeds / lists from savedFeedsPrefV2, in stored order.
 *
 * Feed generator + list display names are hydrated in a single batched call so
 * tabs read "Discover" rather than a raw AT-URI. While that batch is in flight
 * the tab label falls back to the rkey.
 */
export function usePinnedFeeds() {
  const { agent, did, isAuthed } = useAgent()

  return useQuery({
    queryKey: qk.pinnedTabs(did),
    enabled: isAuthed,
    staleTime: 60_000,
    queryFn: async (): Promise<HomeTab[]> => {
      const prefs = await getPrefs(agent)
      const saved = readSavedFeeds(prefs)

      // Following is the canonical first tab. If the user pinned a timeline
      // SavedFeed we adopt its id so unpinning/reordering round-trips; else a
      // synthetic id that the edit flow treats as the immovable anchor.
      const timelineSaved = saved.find((s) => s.type === 'timeline')
      const followingTab: HomeTab = {
        key: 'following',
        label: 'Following',
        kind: 'following',
        value: 'following',
        id: timelineSaved?.id ?? 'timeline',
        pinned: true,
      }

      const pinned = saved.filter((s) => s.pinned && s.type !== 'timeline')

      // Batch-hydrate generator views for nicer labels + avatars.
      const feedUris = pinned.filter((s) => s.type === 'feed').map((s) => s.value)
      const generators = new Map<string, AppBskyFeedDefs.GeneratorView>()
      if (feedUris.length > 0) {
        try {
          const res = await agent.app.bsky.feed.getFeedGenerators({ feeds: feedUris })
          for (const g of res.data.feeds) generators.set(g.uri, g)
        } catch {
          /* labels fall back to rkey; non-fatal */
        }
      }

      const listUris = pinned.filter((s) => s.type === 'list').map((s) => s.value)
      const lists = new Map<string, AppBskyGraphDefs.ListView>()
      if (listUris.length > 0) {
        // getLists is per-actor; for arbitrary list URIs we hydrate via getList
        // one-by-one but tolerate failure (labels fall back to rkey).
        await Promise.all(
          listUris.map(async (uri) => {
            try {
              const r = await agent.app.bsky.graph.getList({ list: uri, limit: 1 })
              lists.set(uri, r.data.list)
            } catch {
              /* ignore */
            }
          }),
        )
      }

      const tabs: HomeTab[] = pinned.flatMap<HomeTab>((s) => {
        const rkey = s.value.split('/').pop() ?? s.value
        if (s.type === 'feed') {
          const g = generators.get(s.value)
          return [{
            key: s.value,
            label: g?.displayName ?? rkey,
            kind: 'feed' as const,
            value: s.value,
            id: s.id,
            avatar: g?.avatar,
            pinned: s.pinned,
          }]
        }
        // A list that didn't hydrate via getList is deleted or inaccessible —
        // its record is gone (the saved pref is stale). Drop it rather than
        // surface a dead tab that labels as the rkey and 404s on selection.
        const l = lists.get(s.value)
        if (!l) return []
        return [{
          key: s.value,
          label: l.name,
          kind: 'list' as const,
          value: s.value,
          id: s.id,
          avatar: l.avatar,
          pinned: s.pinned,
        }]
      })

      return [followingTab, ...tabs]
    },
  })
}
