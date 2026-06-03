import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type {
  AppBskyActorDefs,
  AppBskyGraphGetMutes,
  AppBskyGraphGetBlocks,
} from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type MutesPage = AppBskyGraphGetMutes.OutputSchema
type BlocksPage = AppBskyGraphGetBlocks.OutputSchema

/**
 * Accounts the viewer has muted. Mute is server-side state (not a repo record),
 * so this is the only place to enumerate it — there's no mutes collection to
 * list. Viewer-scoped key so an account switch refetches.
 */
export function useMutes() {
  const { agent, did, isAuthed } = useAgent()
  return useInfiniteQuery<MutesPage>({
    queryKey: qk.mutes(did),
    enabled: isAuthed,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.graph.getMutes({
        limit: 50,
        cursor: pageParam as string | undefined,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/** Accounts the viewer has blocked. Each block IS a repo record; the record's
 * AT-URI rides on profile.viewer.blocking and is what we delete to unblock. */
export function useBlocks() {
  const { agent, did, isAuthed } = useAgent()
  return useInfiniteQuery<BlocksPage>({
    queryKey: qk.blocks(did),
    enabled: isAuthed,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await agent.app.bsky.graph.getBlocks({
        limit: 50,
        cursor: pageParam as string | undefined,
      })
      return res.data
    },
    getNextPageParam: (last) => last.cursor || undefined,
  })
}

/** Drop one actor from every cached page of an infinite mutes/blocks list. */
function dropActor<P>(
  pages: P[],
  field: 'mutes' | 'blocks',
  did: string,
): P[] {
  return pages.map((pg) => {
    const list = (pg as Record<string, AppBskyActorDefs.ProfileView[]>)[field]
    return { ...pg, [field]: list.filter((a) => a.did !== did) }
  })
}

/**
 * Invalidate any cached profile for an actor so its viewer.muted/blocking flips
 * the next time it's read. The profile cache is keyed by the route param (handle
 * or did), so we touch both forms.
 */
function invalidateProfile(
  qc: ReturnType<typeof useQueryClient>,
  actor: AppBskyActorDefs.ProfileView,
) {
  qc.invalidateQueries({ queryKey: qk.profile(actor.did) })
  if (actor.handle) qc.invalidateQueries({ queryKey: qk.profile(actor.handle) })
}

/** Unmute, optimistically removing the row from the muted list. */
export function useUnmute() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const key = qk.mutes(did)
  return useMutation({
    mutationFn: (actor: AppBskyActorDefs.ProfileView) =>
      agent.app.bsky.graph.unmuteActor({ actor: actor.did }).then(() => {}),
    onMutate: async (actor) => {
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueryData<InfiniteData<MutesPage>>(key)
      qc.setQueryData<InfiniteData<MutesPage>>(key, (prev) =>
        prev ? { ...prev, pages: dropActor(prev.pages, 'mutes', actor.did) } : prev,
      )
      return { snapshot }
    },
    onError: (_e, _v, ctx) => ctx?.snapshot && qc.setQueryData(key, ctx.snapshot),
    onSuccess: (_d, actor) => invalidateProfile(qc, actor),
  })
}

/** Unblock by deleting the block record, optimistically removing the row. */
export function useUnblock() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const key = qk.blocks(did)
  return useMutation({
    mutationFn: async (actor: AppBskyActorDefs.ProfileView) => {
      const blockUri = actor.viewer?.blocking
      if (!blockUri) return
      await agent.app.bsky.graph.block.delete({
        repo: agent.assertDid,
        rkey: blockUri.split('/').pop()!,
      })
    },
    onMutate: async (actor) => {
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueryData<InfiniteData<BlocksPage>>(key)
      qc.setQueryData<InfiniteData<BlocksPage>>(key, (prev) =>
        prev ? { ...prev, pages: dropActor(prev.pages, 'blocks', actor.did) } : prev,
      )
      return { snapshot }
    },
    onError: (_e, _v, ctx) => ctx?.snapshot && qc.setQueryData(key, ctx.snapshot),
    onSuccess: (_d, actor) => invalidateProfile(qc, actor),
  })
}
