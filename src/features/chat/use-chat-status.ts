import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

/**
 * Viewer's chat actor status (chat.bsky.actor.getStatus). Server-authoritative
 * gate for group creation: `canCreateGroups` is false for new accounts and
 * `chatDisabled` covers age-restricted / suspended accounts. `groupMemberLimit`
 * bounds the create/add flows. This is the single gate ovoid uses — there is no
 * separate client-side age system to mirror.
 */
export function chatStatusOptions(chatAgent: Agent, did: string | undefined) {
  return queryOptions({
    queryKey: qk.chatStatus(did),
    queryFn: () => chatAgent.chat.bsky.actor.getStatus().then((r) => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useChatStatus() {
  const { chatAgent, did, isAuthed } = useAgent()
  const query = useQuery({
    ...chatStatusOptions(chatAgent as Agent, did),
    enabled: isAuthed && !!chatAgent,
  })
  return {
    ...query,
    canCreateGroups: query.data?.canCreateGroups ?? false,
    chatDisabled: query.data?.chatDisabled ?? false,
    groupMemberLimit: query.data?.groupMemberLimit ?? 0,
  }
}
