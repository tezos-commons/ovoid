import { useMutation, useQuery, useQueryClient, queryOptions } from '@tanstack/react-query'
import type {
  Agent,
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyGraphDefs,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { getPrefs, updatePref } from '@/lib/prefs'

/* ------------------------------------------------------------------ *
 * savedFeedsPrefV2 model.
 *
 * The entry is { $type, items: SavedFeed[] } where
 *   SavedFeed = { id, type: 'feed'|'list'|'timeline', value, pinned }.
 * `value` is: an app.bsky.feed.generator AT-URI (feed), a list AT-URI (list),
 * or the literal "following" (timeline). Array order = display order.
 *
 * We write V2 exclusively; the legacy savedFeedsPref (v1) is only read for
 * back-compat (older accounts), then folded into the V2 view in memory.
 * ------------------------------------------------------------------ */

const SAVED_V2 = 'app.bsky.actor.defs#savedFeedsPrefV2'
const SAVED_V1 = 'app.bsky.actor.defs#savedFeedsPref'

export type SavedFeed = AppBskyActorDefs.SavedFeed
type SavedFeedsPrefV2 = AppBskyActorDefs.SavedFeedsPrefV2

/** A SavedFeed joined with its hydrated generator/list view (when resolvable). */
export interface HydratedSavedFeed {
  saved: SavedFeed
  /** Display name, avatar, etc. Present for feed/list; synthetic for timeline. */
  view:
    | { kind: 'feed'; feed: AppBskyFeedDefs.GeneratorView }
    | { kind: 'list'; list: AppBskyGraphDefs.ListView }
    | { kind: 'timeline' }
    | { kind: 'unknown' }
}

function tid(): string {
  // Stable-enough client id for a SavedFeed. Not a real TID, but the server
  // only requires uniqueness within the array.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/* ------------------------------------------------------------------ *
 * Read: the saved-feeds list, hydrated for display.
 * ------------------------------------------------------------------ */
/** Shared query config for the hydrated saved-feeds list (hook + nav prefetch). */
export function savedFeedsOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.savedFeeds(did),
    queryFn: async (): Promise<HydratedSavedFeed[]> => {
      const prefs = await getPrefs(agent)
      const items = collectSavedFeeds(prefs)
      return hydrateSavedFeeds(agent, items)
    },
  })
}

export function useSavedFeeds() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({ ...savedFeedsOptions(agent, did), enabled: isAuthed })
}

/** Merge V2 items with any legacy V1 entries not already present in V2. */
function collectSavedFeeds(prefs: AppBskyActorDefs.Preferences): SavedFeed[] {
  const v2 = prefs.find((p) => p.$type === SAVED_V2) as SavedFeedsPrefV2 | undefined
  const items: SavedFeed[] = v2?.items ? [...v2.items] : []

  const v1 = prefs.find((p) => p.$type === SAVED_V1) as
    | { pinned?: string[]; saved?: string[] }
    | undefined
  if (v1) {
    const seen = new Set(items.map((i) => i.value))
    const pinned = new Set(v1.pinned ?? [])
    for (const uri of v1.saved ?? []) {
      if (seen.has(uri)) continue
      items.push({
        id: tid(),
        type: uri.includes('/app.bsky.graph.list/') ? 'list' : 'feed',
        value: uri,
        pinned: pinned.has(uri),
      })
    }
  }
  return items
}

/**
 * Resolve generator/list views for the saved entries in a few batched calls.
 * getFeedGenerators takes feeds[]; lists are fetched individually (no batch
 * endpoint). Timeline ("following") is synthetic. Unresolvable entries (e.g. a
 * deleted feed) still render with a fallback label.
 */
async function hydrateSavedFeeds(
  agent: Agent,
  items: SavedFeed[],
): Promise<HydratedSavedFeed[]> {
  const feedUris = items.filter((i) => i.type === 'feed').map((i) => i.value)
  const listUris = items.filter((i) => i.type === 'list').map((i) => i.value)

  const feedViews = new Map<string, AppBskyFeedDefs.GeneratorView>()
  if (feedUris.length) {
    try {
      const res = await agent.app.bsky.feed.getFeedGenerators({ feeds: feedUris })
      for (const f of res.data.feeds) feedViews.set(f.uri, f)
    } catch {
      /* leave unresolved; rendered with fallback */
    }
  }

  const listViews = new Map<string, AppBskyGraphDefs.ListView>()
  await Promise.all(
    listUris.map(async (uri) => {
      try {
        const res = await agent.app.bsky.graph.getList({ list: uri, limit: 1 })
        listViews.set(uri, res.data.list)
      } catch {
        /* leave unresolved */
      }
    }),
  )

  return items.map((saved) => {
    if (saved.type === 'timeline') return { saved, view: { kind: 'timeline' } }
    if (saved.type === 'feed') {
      const feed = feedViews.get(saved.value)
      return { saved, view: feed ? { kind: 'feed', feed } : { kind: 'unknown' } }
    }
    if (saved.type === 'list') {
      const list = listViews.get(saved.value)
      return { saved, view: list ? { kind: 'list', list } : { kind: 'unknown' } }
    }
    return { saved, view: { kind: 'unknown' } }
  })
}

/* ------------------------------------------------------------------ *
 * Mutations: pin/unpin and remove. All go through updatePref, which does the
 * mandatory read-modify-write of the whole preferences array. We always write
 * the V2 entry (never V1).
 * ------------------------------------------------------------------ */

function mutateItems(
  mutate: (items: SavedFeed[]) => SavedFeed[],
) {
  return (entry: SavedFeedsPrefV2 | undefined): SavedFeedsPrefV2 => {
    const items = entry?.items ? [...entry.items] : []
    return { $type: SAVED_V2, items: mutate(items) }
  }
}

export function useSavedFeedActions() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.preferences(did) })
    qc.invalidateQueries({ queryKey: qk.myFeeds(did) })
  }

  const setPinned = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await updatePref<SavedFeedsPrefV2>(
        agent,
        SAVED_V2,
        mutateItems((items) =>
          items.map((it) => (it.id === id ? { ...it, pinned } : it)),
        ),
      )
    },
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await updatePref<SavedFeedsPrefV2>(
        agent,
        SAVED_V2,
        mutateItems((items) => items.filter((it) => it.id !== id)),
      )
    },
    onSettled: invalidate,
  })

  return { setPinned, remove }
}
