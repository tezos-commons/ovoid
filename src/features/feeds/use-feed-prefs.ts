import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { getPrefs, updatePref } from '@/lib/prefs'

type SavedFeed = AppBskyActorDefs.SavedFeed
type SavedFeedsPrefV2 = AppBskyActorDefs.SavedFeedsPrefV2

const PREF_TYPE = 'app.bsky.actor.defs#savedFeedsPrefV2' as const

/**
 * The viewer's saved-feed state, derived from preferences. This is the read
 * side that the UI consults to render the pin/save toggle state of any
 * generator. Keyed by viewer DID so an account switch re-fetches.
 *
 * Returns a Map keyed by AT-URI -> SavedFeed for O(1) per-card lookup, plus the
 * raw ordered items (order == display order; pinned subset are the home tabs).
 */
export function useSavedFeedsState() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    queryKey: [...qk.preferences(did), 'savedFeedsState'] as const,
    enabled: isAuthed,
    queryFn: async () => {
      const prefs = await getPrefs(agent)
      const entry = prefs.find((p) => p.$type === PREF_TYPE) as
        | SavedFeedsPrefV2
        | undefined
      const items = entry?.items ?? []
      const byValue = new Map<string, SavedFeed>()
      for (const it of items) byValue.set(it.value, it)
      return { items, byValue }
    },
    staleTime: 60_000,
  })
}

/** Stable client-generated id for a SavedFeed entry. */
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Compute the next savedFeedsPrefV2.items given an intent against one feed/list.
 *
 * Invariant we preserve: a `pinned` feed must also be `saved` (it has a row in
 * the items array). "Save" == presence in items with pinned:false; "Pin" ==
 * presence with pinned:true; "Unsave" == absence. Pinning an unsaved feed adds
 * it pinned; unpinning keeps it saved.
 */
type FeedKind = 'feed' | 'list'
function reduceItems(
  items: SavedFeed[],
  value: string,
  kind: FeedKind,
  action: 'pin' | 'unpin' | 'save' | 'unsave',
): SavedFeed[] {
  const next = items.map((i) => ({ ...i }))
  const idx = next.findIndex((i) => i.value === value)

  switch (action) {
    case 'save':
      if (idx === -1) {
        next.push({ id: newId(), type: kind, value, pinned: false })
      }
      return next
    case 'unsave':
      return next.filter((i) => i.value !== value)
    case 'pin':
      if (idx === -1) {
        next.push({ id: newId(), type: kind, value, pinned: true })
      } else {
        next[idx].pinned = true
      }
      return next
    case 'unpin':
      if (idx !== -1) next[idx].pinned = false
      return next
  }
}

interface ToggleArgs {
  value: string // AT-URI of the generator (or list)
  kind?: FeedKind
}

/**
 * Pin/save mutations. Each is read-modify-write of the whole preferences array
 * via `updatePref`, then an invalidate of the preferences key so every visible
 * card and the home tab strip reconcile. We deliberately do NOT optimistically
 * patch: the write is cheap, prefs are point-budgeted, and toggles are not on a
 * scroll hot-path, so a refetch-after-settle is simpler and correct.
 */
export function useFeedPrefs() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()

  const run = (action: 'pin' | 'unpin' | 'save' | 'unsave') =>
    async ({ value, kind = 'feed' }: ToggleArgs) => {
      await updatePref<SavedFeedsPrefV2>(agent, PREF_TYPE, (entry) => ({
        $type: PREF_TYPE,
        items: reduceItems(entry?.items ?? [], value, kind, action),
      }))
    }

  const onSettled = () => {
    qc.invalidateQueries({ queryKey: qk.preferences(did) })
    qc.invalidateQueries({ queryKey: qk.myFeeds(did) })
  }

  const pin = useMutation({ mutationFn: run('pin'), onSettled })
  const unpin = useMutation({ mutationFn: run('unpin'), onSettled })
  const save = useMutation({ mutationFn: run('save'), onSettled })
  const unsave = useMutation({ mutationFn: run('unsave'), onSettled })

  return { pin, unpin, save, unsave }
}
