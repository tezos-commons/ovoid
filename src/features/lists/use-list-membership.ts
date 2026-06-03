import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/* ------------------------------------------------------------------ helpers */

function rkeyOf(uri: string): string {
  return uri.split('/').pop() ?? ''
}

/* ------------------------------------------------------ list CRUD (records) */

export interface CreateListInput {
  purpose: string // app.bsky.graph.defs#curatelist | #modlist
  name: string
  description?: string
  avatar?: import('@atproto/api').BlobRef
}

/**
 * Create a list record — app.bsky.graph.list via createRecord.
 *
 * Returns the new record's StrongRef. We invalidate the owner's list index so
 * the new card appears; the index is keyed by actor (the viewer's DID/handle).
 */
export function useCreateList() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateListInput) => {
      const res = await agent.com.atproto.repo.createRecord({
        repo: did!,
        collection: 'app.bsky.graph.list',
        record: {
          $type: 'app.bsky.graph.list',
          purpose: input.purpose,
          name: input.name,
          description: input.description || undefined,
          avatar: input.avatar,
          createdAt: new Date().toISOString(),
        },
      })
      return res.data // { uri, cid }
    },
    onSuccess: () => {
      if (did) qc.invalidateQueries({ queryKey: qk.lists(did) })
    },
  })
}

export interface EditListInput {
  listUri: string
  purpose: string
  name: string
  description?: string
  avatar?: import('@atproto/api').BlobRef
  /** Pass through the previous avatar BlobRef to avoid wiping it on edit. */
  keepAvatar?: import('@atproto/api').BlobRef
}

/**
 * Edit a list — putRecord replaces the whole record, so we re-send every field.
 * If a new avatar isn't supplied we re-send `keepAvatar` to preserve it (same
 * read-modify-write rule as profile edits).
 */
export function useEditList() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EditListInput) => {
      const res = await agent.com.atproto.repo.putRecord({
        repo: did!,
        collection: 'app.bsky.graph.list',
        rkey: rkeyOf(input.listUri),
        record: {
          $type: 'app.bsky.graph.list',
          purpose: input.purpose,
          name: input.name,
          description: input.description || undefined,
          avatar: input.avatar ?? input.keepAvatar,
          createdAt: new Date().toISOString(),
        },
      })
      return res.data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.list(vars.listUri) })
      if (did) qc.invalidateQueries({ queryKey: qk.lists(did) })
    },
  })
}

export function useDeleteList() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (listUri: string) => {
      await agent.com.atproto.repo.deleteRecord({
        repo: did!,
        collection: 'app.bsky.graph.list',
        rkey: rkeyOf(listUri),
      })
    },
    onSuccess: (_d, listUri) => {
      qc.invalidateQueries({ queryKey: qk.list(listUri) })
      if (did) qc.invalidateQueries({ queryKey: qk.lists(did) })
    },
  })
}

/* --------------------------------------------------- membership (listitems) */

/**
 * Add a member — create an app.bsky.graph.listitem record.
 *
 * listitem.subject is a BARE DID (not a StrongRef); .list is the list AT-URI.
 * On success we invalidate the list so the member appears and the count updates.
 */
export function useAddMember() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ listUri, subjectDid }: { listUri: string; subjectDid: string }) => {
      const res = await agent.com.atproto.repo.createRecord({
        repo: did!,
        collection: 'app.bsky.graph.listitem',
        record: {
          $type: 'app.bsky.graph.listitem',
          subject: subjectDid,
          list: listUri,
          createdAt: new Date().toISOString(),
        },
      })
      return res.data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.list(vars.listUri) })
    },
  })
}

/**
 * Remove a member — delete the listitem record by its own URI.
 *
 * ListItemView carries `uri` (the listitem record URI), which is what we delete —
 * NOT the member's profile/DID. Easy to confuse with the subject DID.
 */
export function useRemoveMember() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ listItemUri }: { listUri: string; listItemUri: string }) => {
      await agent.com.atproto.repo.deleteRecord({
        repo: did!,
        collection: 'app.bsky.graph.listitem',
        rkey: rkeyOf(listItemUri),
      })
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.list(vars.listUri) })
    },
  })
}

/* --------------------------------------------- mute / block a whole modlist */

/**
 * Mute a moderation list — app.bsky.graph.muteActorList.
 *
 * Mute is server-side state (no record), so we toggle by calling mute/unmute and
 * invalidate the list to refresh `viewer.muted`.
 */
export function useMuteList() {
  const { agent } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ listUri, muted }: { listUri: string; muted: boolean }) => {
      if (muted) await agent.app.bsky.graph.unmuteActorList({ list: listUri })
      else await agent.app.bsky.graph.muteActorList({ list: listUri })
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.list(vars.listUri) })
    },
  })
}

/**
 * Block a moderation list — app.bsky.graph.listblock record (subject = list URI).
 *
 * Unblock deletes the listblock record; its URI is exposed on
 * ListView.viewer.blocked. listblock.subject is the LIST AT-URI (not a DID).
 */
export function useBlockList() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      listUri,
      blockedUri,
    }: {
      listUri: string
      blockedUri?: string
    }) => {
      if (blockedUri) {
        await agent.com.atproto.repo.deleteRecord({
          repo: did!,
          collection: 'app.bsky.graph.listblock',
          rkey: rkeyOf(blockedUri),
        })
      } else {
        await agent.com.atproto.repo.createRecord({
          repo: did!,
          collection: 'app.bsky.graph.listblock',
          record: {
            $type: 'app.bsky.graph.listblock',
            subject: listUri,
            createdAt: new Date().toISOString(),
          },
        })
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.list(vars.listUri) })
    },
  })
}
