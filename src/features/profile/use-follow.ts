import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppBskyActorDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Optimistic follow / unfollow.
 *
 * Invariant preserved: ProfileViewDetailed.viewer.following holds the follow
 * RECORD uri iff the viewer follows the actor, and followersCount tracks that
 * record's existence. We patch both atomically on the cached profile and roll
 * back on error. follow() takes a bare DID (graph.follow.subject is a DID, not
 * a StrongRef); unfollow deletes the record at viewer.following.
 *
 * Optimistic toggle is keyed off whether followUri is currently set, so a
 * double-click can't create two follow records: the second click sees the
 * optimistic uri sentinel and unfollows instead.
 */
const OPTIMISTIC_URI = 'optimistic:pending-follow'

export function useFollow(actor: string) {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const key = qk.profile(actor)

  return useMutation({
    // Accepts either profile shape — only `did` and `viewer.following` are read;
    // the optimistic cache patch operates on the cached snapshot, not `current`.
    mutationFn: async (
      current: AppBskyActorDefs.ProfileViewDetailed | AppBskyActorDefs.ProfileView,
    ) => {
      const followUri = current.viewer?.following
      if (followUri && followUri !== OPTIMISTIC_URI) {
        await agent.deleteFollow(followUri)
        return { following: undefined as string | undefined }
      }
      const res = await agent.follow(current.did)
      return { following: res.uri }
    },

    onMutate: async (current) => {
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueryData<AppBskyActorDefs.ProfileViewDetailed>(key)
      const wasFollowing = !!current.viewer?.following
      qc.setQueryData<AppBskyActorDefs.ProfileViewDetailed>(key, (prev) =>
        prev
          ? {
              ...prev,
              followersCount: Math.max(0, (prev.followersCount ?? 0) + (wasFollowing ? -1 : 1)),
              viewer: {
                ...prev.viewer,
                following: wasFollowing ? undefined : OPTIMISTIC_URI,
              },
            }
          : prev,
      )
      return { snapshot }
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(key, ctx.snapshot)
    },

    onSuccess: (result) => {
      // Reconcile the optimistic sentinel with the real follow record uri.
      qc.setQueryData<AppBskyActorDefs.ProfileViewDetailed>(key, (prev) =>
        prev ? { ...prev, viewer: { ...prev.viewer, following: result.following } } : prev,
      )
    },

    onSettled: () => {
      // The viewer's own follow count / who-they-follow lists changed too.
      if (did) qc.invalidateQueries({ queryKey: qk.follows(did) })
      qc.invalidateQueries({ queryKey: qk.followers(actor) })
    },
  })
}
