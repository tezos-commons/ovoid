import { useMemo } from 'react'
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import type { Agent, ChatBskyConvoGetConvoMembers } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import type { ConvoMember } from './group'

type Page = ChatBskyConvoGetConvoMembers.OutputSchema

/**
 * The FULL group roster via chat.bsky.convo.getConvoMembers. Distinct from
 * `convo.members` (which carries only a handful of "important" members) — the
 * settings screen needs every member with their role, paginated.
 */
export function convoMembersOptions(
  chatAgent: Agent,
  did: string | undefined,
  convoId: string,
) {
  return infiniteQueryOptions({
    queryKey: qk.convoMembers(did, convoId),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      chatAgent.chat.bsky.convo
        .getConvoMembers({ convoId, cursor: pageParam, limit: 50 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page) => last.cursor || undefined,
    staleTime: 30_000,
    // Always re-fetch the roster when the settings screen mounts: it may have
    // been warmed (ThreadHeader idle-prefetch) before someone joined, and a
    // stale cache would omit the new member even though memberCount includes them.
    refetchOnMount: 'always',
  })
}

export function useConvoMembers(convoId: string | undefined, enabled = true) {
  const { chatAgent, did, isAuthed } = useAgent()
  const on = enabled && isAuthed && !!chatAgent && !!convoId

  const query = useInfiniteQuery({
    ...convoMembersOptions(chatAgent!, did, convoId ?? ''),
    enabled: on,
  })

  const members: ConvoMember[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.members) ?? [],
    [query.data],
  )

  return { ...query, members }
}
