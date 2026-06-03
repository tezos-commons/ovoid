import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppBskyActorProfile } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { uploadImage } from '@/lib/blob'
import { qk } from '@/lib/query-keys'

export interface EditProfileInput {
  displayName: string
  description: string
  /** New avatar file (if the user picked one), else keep existing. */
  avatarFile?: File | null
  /** New banner file (if the user picked one), else keep existing. */
  bannerFile?: File | null
  /** Set when the user explicitly cleared the existing image. */
  removeAvatar?: boolean
  removeBanner?: boolean
}

/**
 * Edit the singleton app.bsky.actor.profile record (rkey "self").
 *
 * Invariant: putRecord REPLACES the whole record — agent.upsertProfile does the
 * read-modify-write atomically, handing us the existing record so we can carry
 * forward fields we don't touch (notably the existing avatar/banner BlobRefs and
 * pinnedPost). Dropping those would wipe the user's avatar. We only overwrite a
 * blob when the user picked a new file (upload first, then merge the BlobRef);
 * an explicit "remove" clears it to undefined.
 *
 * On success we invalidate qk.profile for both the handle and DID forms so the
 * ProfileScreen (which may have been routed by either) refetches the fresh view.
 */
export function useEditProfile() {
  const { agent, did, handle } = useAgent()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: EditProfileInput) => {
      // Upload any new blobs up front so upsertProfile's callback stays sync-ish.
      const avatarBlob = input.avatarFile ? await uploadImage(agent, input.avatarFile) : null
      const bannerBlob = input.bannerFile ? await uploadImage(agent, input.bannerFile) : null

      await agent.upsertProfile((existing?: AppBskyActorProfile.Record) => {
        const next: AppBskyActorProfile.Record = {
          ...existing,
          $type: 'app.bsky.actor.profile',
          displayName: input.displayName.trim() || undefined,
          description: input.description.trim() || undefined,
        }

        if (avatarBlob) next.avatar = avatarBlob
        else if (input.removeAvatar) next.avatar = undefined

        if (bannerBlob) next.banner = bannerBlob
        else if (input.removeBanner) next.banner = undefined

        return next
      })
    },

    onSuccess: () => {
      if (did) qc.invalidateQueries({ queryKey: qk.profile(did) })
      if (handle) qc.invalidateQueries({ queryKey: qk.profile(handle) })
    },
  })
}
