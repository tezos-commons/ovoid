import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import {
  getChatStatus,
  getPreferences,
  listConvoMutes,
  listDevices,
  listMutes,
  listThreadMutes,
  listWatches,
  notifyConfigured,
  putConvoMute,
  putMute,
  putPreferences,
  putThreadMute,
  putWatch,
  type NotifyPrefs,
  type NotifyWatch,
} from './client'

/**
 * Hooks for the notify service. Cross-cutting (settings screen, profile bell,
 * profile menu) — hence lib/, not a feature directory.
 *
 * Reads are cheap-but-not-free (each one mints a service-auth token at the
 * PDS before hitting the backend), so staleTime is generous; this is
 * settings-grade data that only changes through our own mutations, and every
 * mutation patches the cache directly.
 */

const NOTIFY_STALE_MS = 5 * 60_000

export function notifyPrefsOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.notifyPrefs(did),
    queryFn: () => getPreferences(agent),
    staleTime: NOTIFY_STALE_MS,
  })
}

export function notifyDevicesOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.notifyDevices(did),
    queryFn: () => listDevices(agent),
    staleTime: NOTIFY_STALE_MS,
  })
}

export function notifyWatchesOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.notifyWatches(did),
    queryFn: () => listWatches(agent),
    staleTime: NOTIFY_STALE_MS,
  })
}

export function notifyMutesOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.notifyMutes(did),
    queryFn: () => listMutes(agent),
    staleTime: NOTIFY_STALE_MS,
  })
}

export function useNotifyPrefs() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...notifyPrefsOptions(agent, did),
    enabled: isAuthed && notifyConfigured(),
  })
}

export function usePutNotifyPrefs() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: NotifyPrefs) => putPreferences(agent, prefs),
    // Optimistic: a toggle must flip instantly; reconcile from the response.
    onMutate: async (prefs) => {
      await qc.cancelQueries({ queryKey: qk.notifyPrefs(did) })
      const previous = qc.getQueryData<NotifyPrefs>(qk.notifyPrefs(did))
      qc.setQueryData(qk.notifyPrefs(did), prefs)
      return { previous }
    },
    onError: (_err, _prefs, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.notifyPrefs(did), ctx.previous)
    },
    onSuccess: (server) => {
      qc.setQueryData(qk.notifyPrefs(did), server)
    },
  })
}

export function useNotifyDevices() {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...notifyDevicesOptions(agent, did),
    enabled: isAuthed && notifyConfigured(),
  })
}

export function useNotifyWatches(enabled = true) {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...notifyWatchesOptions(agent, did),
    enabled: enabled && isAuthed && notifyConfigured(),
  })
}

export function usePutWatch() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (watch: NotifyWatch) => putWatch(agent, watch),
    onMutate: async (watch) => {
      await qc.cancelQueries({ queryKey: qk.notifyWatches(did) })
      const previous = qc.getQueryData<NotifyWatch[]>(qk.notifyWatches(did))
      qc.setQueryData<NotifyWatch[]>(qk.notifyWatches(did), (old = []) => {
        const rest = old.filter((w) => w.subject !== watch.subject)
        return watch.posts || watch.replies ? [...rest, watch] : rest
      })
      return { previous }
    },
    onError: (_err, _watch, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.notifyWatches(did), ctx.previous)
    },
  })
}

export function useNotifyMutes(enabled = true) {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...notifyMutesOptions(agent, did),
    enabled: enabled && isAuthed && notifyConfigured(),
  })
}

export function notifyThreadMutesOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.notifyThreadMutes(did),
    queryFn: () => listThreadMutes(agent),
    staleTime: NOTIFY_STALE_MS,
  })
}

export function useNotifyThreadMutes(enabled = true) {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...notifyThreadMutesOptions(agent, did),
    enabled: enabled && isAuthed && notifyConfigured(),
  })
}

export function usePutThreadMute() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ root, muted }: { root: string; muted: boolean }) =>
      putThreadMute(agent, root, muted),
    onMutate: async ({ root, muted }) => {
      await qc.cancelQueries({ queryKey: qk.notifyThreadMutes(did) })
      const previous = qc.getQueryData<string[]>(qk.notifyThreadMutes(did))
      qc.setQueryData<string[]>(qk.notifyThreadMutes(did), (old = []) =>
        muted ? [...old.filter((r) => r !== root), root] : old.filter((r) => r !== root),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.notifyThreadMutes(did), ctx.previous)
    },
  })
}

export function notifyChatStatusOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.notifyChatStatus(did),
    queryFn: () => getChatStatus(agent),
    staleTime: NOTIFY_STALE_MS,
  })
}

export function notifyConvoMutesOptions(agent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.notifyConvoMutes(did),
    queryFn: () => listConvoMutes(agent),
    staleTime: NOTIFY_STALE_MS,
  })
}

export function useNotifyChatStatus(enabled = true) {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...notifyChatStatusOptions(agent, did),
    enabled: enabled && isAuthed && notifyConfigured(),
  })
}

export function useNotifyConvoMutes(enabled = true) {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...notifyConvoMutesOptions(agent, did),
    enabled: enabled && isAuthed && notifyConfigured(),
  })
}

export function usePutConvoMute() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ convoId, muted }: { convoId: string; muted: boolean }) =>
      putConvoMute(agent, convoId, muted),
    onMutate: async ({ convoId, muted }) => {
      await qc.cancelQueries({ queryKey: qk.notifyConvoMutes(did) })
      const previous = qc.getQueryData<string[]>(qk.notifyConvoMutes(did))
      qc.setQueryData<string[]>(qk.notifyConvoMutes(did), (old = []) =>
        muted ? [...old.filter((c) => c !== convoId), convoId] : old.filter((c) => c !== convoId),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.notifyConvoMutes(did), ctx.previous)
    },
  })
}

export function usePutNotifyMute() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ subject, muted }: { subject: string; muted: boolean }) =>
      putMute(agent, subject, muted),
    onMutate: async ({ subject, muted }) => {
      await qc.cancelQueries({ queryKey: qk.notifyMutes(did) })
      const previous = qc.getQueryData<string[]>(qk.notifyMutes(did))
      qc.setQueryData<string[]>(qk.notifyMutes(did), (old = []) =>
        muted ? [...old.filter((s) => s !== subject), subject] : old.filter((s) => s !== subject),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.notifyMutes(did), ctx.previous)
    },
  })
}
