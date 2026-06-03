import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppBskyActorDefs, AppBskyLabelerDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { getPrefs, updatePref, type Prefs } from '@/lib/prefs'

/**
 * Read the full preferences array. Public agent has no preferences, so this is
 * gated on isAuthed by the caller (the settings tree is auth-protected).
 *
 * The cache key is viewer-scoped (qk.preferences(did)); a logout removes it via
 * qc.removeQueries({ queryKey: qk.all }).
 */
export function usePreferences() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery<Prefs>({
    queryKey: qk.preferences(did),
    queryFn: () => getPrefs(agent),
    enabled: isAuthed,
    staleTime: 60_000,
  })
}

/* ---------- typed selectors over the heterogeneous array ---------- */

type MutedWordsPref = AppBskyActorDefs.MutedWordsPref & { $type: string }
type AdultContentPref = AppBskyActorDefs.AdultContentPref & { $type: string }
type LabelersPref = AppBskyActorDefs.LabelersPref & { $type: string }

const MUTED_WORDS = 'app.bsky.actor.defs#mutedWordsPref'
const ADULT_CONTENT = 'app.bsky.actor.defs#adultContentPref'
const LABELERS = 'app.bsky.actor.defs#labelersPref'

export function selectMutedWords(prefs: Prefs | undefined): AppBskyActorDefs.MutedWord[] {
  const entry = prefs?.find((p) => p.$type === MUTED_WORDS) as MutedWordsPref | undefined
  return entry?.items ?? []
}

export function selectAdultContentEnabled(prefs: Prefs | undefined): boolean {
  const entry = prefs?.find((p) => p.$type === ADULT_CONTENT) as AdultContentPref | undefined
  return entry?.enabled ?? false
}

export function selectLabelers(prefs: Prefs | undefined): AppBskyActorDefs.LabelerPrefItem[] {
  const entry = prefs?.find((p) => p.$type === LABELERS) as LabelersPref | undefined
  return entry?.labelers ?? []
}

/**
 * Resolve a set of labeler DIDs to their service views in a single getServices
 * call, returning a did -> view map for O(1) lookup. The labelersPref only
 * stores DIDs; the human-readable name lives on view.creator (displayName /
 * handle). Keyed by the sorted DID set so an unchanged set hits the cache.
 */
export function useLabelerProfiles(dids: string[]) {
  const { agent } = useAgent()
  const sorted = [...dids].sort()
  return useQuery({
    queryKey: qk.labelerDirectory(sorted.join(',')),
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await agent.app.bsky.labeler.getServices({ dids: sorted })
      const byDid = new Map<string, AppBskyLabelerDefs.LabelerView>()
      for (const v of res.data.views as AppBskyLabelerDefs.LabelerView[]) {
        byDid.set(v.creator.did, v)
      }
      return byDid
    },
  })
}

/* ---------- mutations (read-modify-write whole array via lib/prefs) ---------- */

/** Add / remove a muted word. value is matched case-insensitively on the literal. */
export function useMutedWordsMutation() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (op: { action: 'add' | 'remove'; value: string }) => {
      const value = op.value.trim()
      if (!value) return
      await updatePref<MutedWordsPref>(agent, MUTED_WORDS, (entry) => {
        const items = entry?.items ?? []
        if (op.action === 'add') {
          if (items.some((w) => w.value.toLowerCase() === value.toLowerCase())) {
            return { $type: MUTED_WORDS, items }
          }
          const word: AppBskyActorDefs.MutedWord = {
            value,
            targets: ['content', 'tag'] as AppBskyActorDefs.MutedWordTarget[],
            actorTarget: 'all',
          }
          return { $type: MUTED_WORDS, items: [...items, word] }
        }
        return {
          $type: MUTED_WORDS,
          items: items.filter((w) => w.value.toLowerCase() !== value.toLowerCase()),
        }
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.preferences(did) }),
  })
}

/** Toggle whether adult content is allowed to render. */
export function useAdultContentMutation() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      await updatePref<AdultContentPref>(agent, ADULT_CONTENT, () => ({
        $type: ADULT_CONTENT,
        enabled,
      }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.preferences(did) }),
  })
}
