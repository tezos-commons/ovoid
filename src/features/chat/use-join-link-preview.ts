import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Agent, ChatBskyGroupDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { chatPreviewAgent } from '@/lib/api/proxy'
import { qk } from '@/lib/query-keys'

export type JoinLinkPreview =
  | ChatBskyGroupDefs.JoinLinkPreviewView
  | ChatBskyGroupDefs.DisabledJoinLinkPreviewView
  | ChatBskyGroupDefs.InvalidJoinLinkPreviewView
  | { $type: string; code?: string }

const VALID = 'chat.bsky.group.defs#joinLinkPreviewView'
const DISABLED = 'chat.bsky.group.defs#disabledJoinLinkPreviewView'

export function isValidPreview(p: JoinLinkPreview): p is ChatBskyGroupDefs.JoinLinkPreviewView {
  return p.$type === VALID
}
export function isDisabledPreview(
  p: JoinLinkPreview,
): p is ChatBskyGroupDefs.DisabledJoinLinkPreviewView {
  return p.$type === DISABLED
}

/**
 * Resolve a group invite code to a preview (chat.bsky.group.getJoinLinkPreviews).
 *
 * Public read: works unauthenticated, so the logged-out invite landing can show
 * the group's name/member-count before sign-in. The result is a union — a valid
 * preview, a disabled link, or an invalid code. Key omits `did` (shared across
 * viewers).
 */
export function joinLinkPreviewOptions(agent: Agent, code: string) {
  return queryOptions({
    queryKey: qk.joinLinkPreview(code),
    queryFn: async (): Promise<JoinLinkPreview | undefined> => {
      const res = await agent.chat.bsky.group.getJoinLinkPreviews({ codes: [code] })
      return res.data.joinLinkPreviews[0]
    },
    staleTime: 60_000,
  })
}

/**
 * Reads via the authed chat-proxied agent when signed in, else a throwaway agent
 * pointed straight at the chat service (the endpoint is public). The appview
 * public agent would NOT serve chat.bsky.* — it must hit api.bsky.chat directly.
 * `enabled` only on a non-empty code.
 */
export function useJoinLinkPreview(code: string | undefined) {
  const { chatAgent } = useAgent()
  const reader = chatAgent ?? chatPreviewAgent()
  return useQuery({
    ...joinLinkPreviewOptions(reader, code ?? ''),
    enabled: !!code,
  })
}
