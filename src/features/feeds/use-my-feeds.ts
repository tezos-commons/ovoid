import { useQuery } from '@tanstack/react-query'
import type { AppBskyActorDefs, AppBskyFeedDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { getPrefs } from '@/lib/prefs'

type SavedFeed = AppBskyActorDefs.SavedFeed
type SavedFeedsPrefV2 = AppBskyActorDefs.SavedFeedsPrefV2
type GeneratorView = AppBskyFeedDefs.GeneratorView

const PREF_TYPE = 'app.bsky.actor.defs#savedFeedsPrefV2'

export interface MyFeeds {
  /** Saved entries that are pinned (the home tab strip), in display order. */
  pinned: GeneratorView[]
  /** Saved entries that are NOT pinned, in display order. */
  saved: GeneratorView[]
  /** All saved feed-type entries hydrated, in display order. */
  all: GeneratorView[]
}

/**
 * Hydrate the viewer's saved feed generators into full GeneratorViews.
 *
 * Source of truth is savedFeedsPrefV2 (read-modify-written elsewhere). We
 * extract the `type:"feed"` entries' AT-URIs and batch-hydrate them with
 * getFeedGenerators (one call, ordered to match the prefs order). `type:"list"`
 * and `type:"timeline"` entries are ignored here — they belong to Lists/Home.
 *
 * Keyed by viewer DID; depends on the same prefs the toggles invalidate, so
 * pinning/saving anywhere refreshes this list.
 */
export function useMyFeeds() {
  const { agent, did, isAuthed } = useAgent()

  return useQuery<MyFeeds>({
    queryKey: qk.myFeeds(did),
    enabled: isAuthed,
    staleTime: 60_000,
    queryFn: async () => {
      const prefs = await getPrefs(agent)
      const entry = prefs.find((p) => p.$type === PREF_TYPE) as
        | SavedFeedsPrefV2
        | undefined
      const feedItems: SavedFeed[] = (entry?.items ?? []).filter(
        (i) => i.type === 'feed',
      )
      if (feedItems.length === 0) {
        return { pinned: [], saved: [], all: [] }
      }

      const uris = feedItems.map((i) => i.value)
      // getFeedGenerators caps at a generous batch; saved-feed counts are small.
      const res = await agent.app.bsky.feed.getFeedGenerators({ feeds: uris })
      const byUri = new Map<string, GeneratorView>()
      for (const g of res.data.feeds) byUri.set(g.uri, g)

      // Preserve prefs order; drop any URI the appview couldn't resolve.
      const all: GeneratorView[] = []
      const pinned: GeneratorView[] = []
      const saved: GeneratorView[] = []
      for (const it of feedItems) {
        const g = byUri.get(it.value)
        if (!g) continue
        all.push(g)
        if (it.pinned) pinned.push(g)
        else saved.push(g)
      }
      return { pinned, saved, all }
    },
  })
}
