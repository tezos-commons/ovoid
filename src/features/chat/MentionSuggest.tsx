import { useMemo } from 'react'
import type { AppBskyActorDefs } from '@atproto/api'
import { useTypeahead } from '@/features/search/use-typeahead'
import type { ConvoMember } from './group'

/** The @-token under the caret: where it starts and the partial after the @. */
export interface MentionToken {
  start: number
  query: string
}

/**
 * The active mention token at `caret`, or null. A token is an @ at the start
 * of the text or after whitespace, with the caret inside or at the end of its
 * handle-charset run — `hey @ali|` matches, `mail@exa|mple.com` doesn't.
 */
export function findMentionToken(value: string, caret: number): MentionToken | null {
  const before = value.slice(0, caret)
  const m = before.match(/(?:^|\s)@([a-zA-Z0-9.-]*)$/)
  if (!m) return null
  return { start: before.length - m[1].length - 1, query: m[1] }
}

export interface MentionCandidate {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

/**
 * Suggestions for an active mention token: convo members first (instant, no
 * network — in a group they're who you most likely mean), then the actor
 * typeahead (debounced, shared search query) for everyone else. Deduped by
 * DID, viewer excluded, capped at 6.
 */
export function useMentionCandidates(
  token: MentionToken | null,
  members: ConvoMember[],
  viewerDid: string | undefined,
): MentionCandidate[] {
  const { actors } = useTypeahead(token ? token.query : '')
  const query = token?.query.toLowerCase() ?? ''

  return useMemo(() => {
    if (!token) return []
    const out: MentionCandidate[] = []
    const seen = new Set<string>()
    const push = (a: Pick<AppBskyActorDefs.ProfileViewBasic, 'did' | 'handle' | 'displayName' | 'avatar'>) => {
      if (a.did === viewerDid || seen.has(a.did)) return
      if (!a.handle || a.handle === 'handle.invalid') return
      seen.add(a.did)
      out.push({ did: a.did, handle: a.handle, displayName: a.displayName, avatar: a.avatar })
    }
    for (const m of members) {
      if (
        !query ||
        m.handle?.toLowerCase().includes(query) ||
        m.displayName?.toLowerCase().includes(query)
      ) {
        push(m)
      }
    }
    for (const a of actors) push(a)
    return out.slice(0, 6)
  }, [token, query, members, actors, viewerDid])
}
