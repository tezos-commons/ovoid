import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { getPrefs, updatePref } from '@/lib/prefs'
import { qk } from '@/lib/query-keys'

const SAVED_V2 = 'app.bsky.actor.defs#savedFeedsPrefV2'

interface SavedFeed {
  id: string
  type: 'feed' | 'list' | 'timeline'
  value: string
  pinned: boolean
}

interface SavedFeedsPrefV2 {
  $type: typeof SAVED_V2
  items: SavedFeed[]
}

/** Client-generated stable id for a new saved-feed entry (no crypto dependency). */
function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  )
}

/**
 * Whether a list is currently saved/pinned in the viewer's savedFeedsPrefV2.
 *
 * A list is "subscribed" in the curate sense when it appears as a saved feed of
 * type:"list"; pinned means it's also a home tab. Reads the whole prefs array.
 */
export function useListSaved(listUri: string | undefined) {
  const { agent, did } = useAgent()
  return useQuery({
    queryKey: [...qk.preferences(did), 'savedList', listUri],
    enabled: !!listUri,
    queryFn: async () => {
      const prefs = await getPrefs(agent)
      const entry = prefs.find((p) => p.$type === SAVED_V2) as
        | SavedFeedsPrefV2
        | undefined
      const item = entry?.items.find((i) => i.type === 'list' && i.value === listUri)
      return { saved: !!item, pinned: !!item?.pinned }
    },
  })
}

/**
 * Toggle a curate list as a saved/pinned home feed via putPreferences.
 *
 * Read-modify-write the whole savedFeedsPrefV2.items array (the server replaces
 * it wholesale). `pin` controls the pinned flag; saving a list always adds it
 * with type:"list" and value=<list uri>.
 */
export function useToggleListPin() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      listUri,
      next,
    }: {
      listUri: string
      /** Desired end state: 'pinned' | 'saved' | 'removed'. */
      next: 'pinned' | 'saved' | 'removed'
    }) => {
      await updatePref<SavedFeedsPrefV2>(agent, SAVED_V2, (entry) => {
        const items = entry?.items ? entry.items.slice() : []
        const idx = items.findIndex((i) => i.type === 'list' && i.value === listUri)
        if (next === 'removed') {
          if (idx >= 0) items.splice(idx, 1)
        } else if (idx >= 0) {
          items[idx] = { ...items[idx], pinned: next === 'pinned' }
        } else {
          items.push({
            id: newId(),
            type: 'list',
            value: listUri,
            pinned: next === 'pinned',
          })
        }
        return { $type: SAVED_V2, items }
      })
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.preferences(did) })
      qc.invalidateQueries({
        queryKey: [...qk.preferences(did), 'savedList', vars.listUri],
      })
      if (did) qc.invalidateQueries({ queryKey: qk.myFeeds(did) })
    },
  })
}
