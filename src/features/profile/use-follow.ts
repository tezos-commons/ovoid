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

type AnyProfile =
  | AppBskyActorDefs.ProfileViewDetailed
  | AppBskyActorDefs.ProfileView

export function useFollow(actor: string) {
  const { agent, did } = useAgent()
  const qc = useQueryClient()

  // The same account is cached under whatever identifier each link/prefetch
  // held — its handle AND its DID are distinct qk.profile keys. Patch every one
  // so the follow state can't differ between entries (the cause of a Follow
  // button that's right or wrong depending on which identifier you arrived by).
  // setQueryData no-ops on keys with no cached entry, so this never fabricates.
  const profileKeys = (p: AnyProfile): readonly (readonly unknown[])[] => {
    const ks = [qk.profile(p.did)]
    if (p.handle) ks.push(qk.profile(p.handle))
    return ks
  }

  return useMutation({
    // Accepts either profile shape — only `did`/`handle`/`viewer.following` are
    // read; the optimistic patch operates on the cached snapshots, not `current`.
    mutationFn: async (current: AnyProfile) => {
      const followUri = current.viewer?.following
      if (followUri && followUri !== OPTIMISTIC_URI) {
        await agent.deleteFollow(followUri)
        return { following: undefined as string | undefined }
      }
      const res = await agent.follow(current.did)
      return { following: res.uri }
    },

    onMutate: async (current) => {
      const keys = profileKeys(current)
      await Promise.all(keys.map((k) => qc.cancelQueries({ queryKey: k })))
      const snapshots = keys.map(
        (k) => [k, qc.getQueryData<AppBskyActorDefs.ProfileViewDetailed>(k)] as const,
      )
      const wasFollowing = !!current.viewer?.following
      for (const k of keys) {
        qc.setQueryData<AppBskyActorDefs.ProfileViewDetailed>(k, (prev) =>
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
      }
      return { snapshots }
    },

    onError: (_e, _v, ctx) => {
      ctx?.snapshots?.forEach(([k, snap]) => qc.setQueryData(k, snap))
    },

    onSuccess: (result, current) => {
      // Reconcile the optimistic sentinel with the real follow record uri.
      for (const k of profileKeys(current)) {
        qc.setQueryData<AppBskyActorDefs.ProfileViewDetailed>(k, (prev) =>
          prev ? { ...prev, viewer: { ...prev.viewer, following: result.following } } : prev,
        )
      }
    },

    onSettled: (_d, _e, current) => {
      // Reconcile every cached representation of the actor with server truth.
      for (const k of profileKeys(current)) qc.invalidateQueries({ queryKey: k })
      // The viewer's own follow count / who-they-follow lists changed too.
      if (did) qc.invalidateQueries({ queryKey: qk.follows(did) })
      qc.invalidateQueries({ queryKey: qk.followers(actor) })
    },
  })
}
