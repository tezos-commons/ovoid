import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppBskyActorDefs, AppBskyLabelerDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { getPrefs, selectLabelerDids, updatePref, type Prefs } from '@/lib/prefs'
import { usePreferences } from '@/features/settings/use-preferences'

const LABELERS = 'app.bsky.actor.defs#labelersPref'

type LabelersPref = AppBskyActorDefs.LabelersPref & { $type: string }

/** Detailed labeler service (policies + label value definitions + like state). */
export function useLabelerService(did: string | undefined, enabled: boolean) {
  const { agent } = useAgent()
  return useQuery<AppBskyLabelerDefs.LabelerViewDetailed | undefined>({
    queryKey: qk.labelerService(did ?? ''),
    enabled: enabled && !!did,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await agent.app.bsky.labeler.getServices({
        dids: [did!],
        detailed: true,
      })
      return res.data.views[0] as AppBskyLabelerDefs.LabelerViewDetailed | undefined
    },
  })
}

/**
 * Subscribe / unsubscribe to a labeler. Toggling rewrites the labelersPref
 * array, re-applies the accept-labelers header to the live agent (so labels
 * appear/disappear without a reload), and invalidates the read caches so
 * profiles/feeds refetch with the new label set.
 */
export function useLabelerSubscription(did: string | undefined) {
  const { agent, did: viewerDid } = useAgent()
  const qc = useQueryClient()
  const prefsQ = usePreferences()

  const subscribed = subscribedTo(prefsQ.data, did)

  const toggle = useMutation({
    mutationFn: async () => {
      if (!did) return
      await updatePref<LabelersPref>(agent, LABELERS, (entry) => {
        const labelers = entry?.labelers ?? []
        const has = labelers.some((l) => l.did === did)
        const next = has
          ? labelers.filter((l) => l.did !== did)
          : [...labelers, { did }]
        return { $type: LABELERS, labelers: next }
      })
      // Re-apply the header from the freshly-written prefs.
      agent.configureLabelers(selectLabelerDids(await getPrefs(agent)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.preferences(viewerDid) })
      // Labels ride on feed, profile and thread reads — refetch only those to
      // pull the changed label set, rather than flushing the entire cache.
      qc.invalidateQueries({
        predicate: (query) => {
          const k = query.queryKey
          return qk.isFeedKey(k) || k[1] === 'profile' || k[1] === 'thread'
        },
      })
    },
  })

  return { subscribed, toggle, isLoading: prefsQ.isLoading }
}

function subscribedTo(prefs: Prefs | undefined, did: string | undefined): boolean {
  if (!prefs || !did) return false
  const entry = prefs.find((p) => p.$type === LABELERS) as
    | (LabelersPref & { labelers?: { did: string }[] })
    | undefined
  return !!entry?.labelers?.some((l) => l.did === did)
}
