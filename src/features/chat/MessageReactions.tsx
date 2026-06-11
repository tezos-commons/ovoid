import { useMemo } from 'react'
import clsx from 'clsx'
import type { ChatBskyConvoDefs } from '@atproto/api'

/** The quick-reaction set offered in the picker. */
export const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥']

interface ReactionGroup {
  value: string
  count: number
  /** The viewer has this reaction. */
  mine: boolean
}

/** Group a message's reactions by emoji, with counts and the viewer's state. */
export function groupReactions(
  reactions: readonly ChatBskyConvoDefs.ReactionView[] | undefined,
  viewerDid: string | undefined,
): ReactionGroup[] {
  if (!reactions || reactions.length === 0) return []
  const map = new Map<string, ReactionGroup>()
  for (const r of reactions) {
    const g = map.get(r.value) ?? { value: r.value, count: 0, mine: false }
    g.count += 1
    if (r.sender.did === viewerDid) g.mine = true
    map.set(r.value, g)
  }
  return [...map.values()]
}

export interface MessageReactionsProps {
  reactions: readonly ChatBskyConvoDefs.ReactionView[] | undefined
  viewerDid: string | undefined
  /** Toggle the viewer's reaction of `value` (add when not already present). */
  onToggle: (value: string, add: boolean) => void
}

/**
 * Reaction pills shown under a bubble. Each emoji groups its reactors; the count
 * renders when >1 (so group chats read cleanly). The viewer's own reactions are
 * highlighted, and tapping a pill toggles it.
 */
export function MessageReactions({ reactions, viewerDid, onToggle }: MessageReactionsProps) {
  const groups = useMemo(() => groupReactions(reactions, viewerDid), [reactions, viewerDid])
  if (groups.length === 0) return null
  return (
    <div className="msg-reactions">
      {groups.map((g) => (
        <button
          key={g.value}
          type="button"
          className={clsx('msg-reaction', g.mine && 'msg-reaction--mine')}
          onClick={() => onToggle(g.value, !g.mine)}
          aria-pressed={g.mine}
          title={g.mine ? 'Remove reaction' : 'React'}
        >
          <span className="msg-reaction__emoji">{g.value}</span>
          {g.count > 1 && <span className="msg-reaction__count">{g.count}</span>}
        </button>
      ))}
    </div>
  )
}
