import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

const COLLECTION = 'site.standard.graph.subscription'

interface SubState {
  subscribed: boolean
  /** rkey of the viewer's subscription record, when subscribed (for delete). */
  rkey: string | null
}

/**
 * Reader subscription to a standard.site publication. A subscription is a record
 * in the *viewer's* repo whose `publication` is the publication's at:// URI, so
 * this requires a session (writes to own repo). The query scans the viewer's
 * subscription collection for one matching `pubUri`; the mutations create/delete
 * it and write the result straight into the cache (no refetch needed).
 */
export function useSubscription(pubUri: string | undefined) {
  const { agent, did, isAuthed } = useAgent()
  const qc = useQueryClient()
  const enabled = isAuthed && !!did && !!pubUri
  const key = qk.standardSubscription(did, pubUri ?? '')

  const query = useQuery({
    queryKey: key,
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<SubState> => {
      let cursor: string | undefined
      do {
        const res = await agent.com.atproto.repo.listRecords({
          repo: did!,
          collection: COLLECTION,
          limit: 100,
          cursor,
        })
        for (const r of res.data.records) {
          if ((r.value as { publication?: string }).publication === pubUri) {
            return { subscribed: true, rkey: r.uri.split('/').pop() ?? null }
          }
        }
        cursor = res.data.cursor
      } while (cursor)
      return { subscribed: false, rkey: null }
    },
  })

  const subscribe = useMutation({
    mutationFn: async () => {
      const res = await agent.com.atproto.repo.createRecord({
        repo: did!,
        collection: COLLECTION,
        record: { $type: COLLECTION, publication: pubUri, createdAt: new Date().toISOString() },
      })
      return res.data.uri.split('/').pop() ?? null
    },
    onSuccess: (rkey) => qc.setQueryData<SubState>(key, { subscribed: true, rkey }),
  })

  const unsubscribe = useMutation({
    mutationFn: async () => {
      const rkey = query.data?.rkey
      if (!rkey) return
      await agent.com.atproto.repo.deleteRecord({ repo: did!, collection: COLLECTION, rkey })
    },
    onSuccess: () => qc.setQueryData<SubState>(key, { subscribed: false, rkey: null }),
  })

  return {
    isAuthed,
    loading: query.isLoading,
    subscribed: query.data?.subscribed ?? false,
    pending: subscribe.isPending || unsubscribe.isPending,
    toggle: () => (query.data?.subscribed ? unsubscribe.mutate() : subscribe.mutate()),
  }
}
