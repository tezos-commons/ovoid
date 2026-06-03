import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Mute / unmute and block / unblock an actor.
 *
 * Mute is server-side state (muteActor/unmuteActor), NOT a repo record — so
 * viewer.muted is a boolean with no uri. Block IS a record: graph.block whose
 * subject is a bare DID; the block record uri lives in viewer.blocking, and
 * deleting that uri unblocks. We patch viewer.muted / viewer.blocking on the
 * cached profile optimistically and roll back on error.
 */
export function useMuteBlock(actor: string) {
  const { agent } = useAgent()
  const qc = useQueryClient()
  const key = qk.profile(actor)

  const patch = (mutate: (v: AppBskyActorDefs.ViewerState) => AppBskyActorDefs.ViewerState) => {
    const snapshot = qc.getQueryData<AppBskyActorDefs.ProfileViewDetailed>(key)
    qc.setQueryData<AppBskyActorDefs.ProfileViewDetailed>(key, (prev) =>
      prev ? { ...prev, viewer: mutate(prev.viewer ?? {}) } : prev,
    )
    return snapshot
  }

  const mute = useMutation({
    mutationFn: async (current: AppBskyActorDefs.ProfileViewDetailed) => {
      if (current.viewer?.muted) await agent.app.bsky.graph.unmuteActor({ actor: current.did })
      else await agent.app.bsky.graph.muteActor({ actor: current.did })
    },
    onMutate: (current) => ({
      snapshot: patch((v) => ({ ...v, muted: !current.viewer?.muted })),
    }),
    onError: (_e, _v, ctx) => ctx?.snapshot && qc.setQueryData(key, ctx.snapshot),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const block = useMutation({
    mutationFn: async (current: AppBskyActorDefs.ProfileViewDetailed) => {
      const blockUri = current.viewer?.blocking
      if (blockUri) {
        await agent.app.bsky.graph.block.delete({
          repo: agent.assertDid,
          rkey: blockUri.split('/').pop()!,
        })
        return { blocking: undefined as string | undefined }
      }
      const res = await agent.app.bsky.graph.block.create(
        { repo: agent.assertDid },
        { subject: current.did, createdAt: new Date().toISOString() },
      )
      return { blocking: res.uri }
    },
    onMutate: (current) => ({
      snapshot: patch((v) => ({
        ...v,
        blocking: current.viewer?.blocking ? undefined : 'optimistic:pending-block',
      })),
    }),
    onError: (_e, _v, ctx) => ctx?.snapshot && qc.setQueryData(key, ctx.snapshot),
    onSuccess: (result) =>
      qc.setQueryData<AppBskyActorDefs.ProfileViewDetailed>(key, (prev) =>
        prev ? { ...prev, viewer: { ...prev.viewer, blocking: result.blocking } } : prev,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return { mute, block }
}
