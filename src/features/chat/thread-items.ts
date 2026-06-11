import type { ChatBskyConvoDefs } from '@atproto/api'
import type { MessageItem } from './use-messages'

const SYSTEM = 'chat.bsky.convo.defs#systemMessageView'
const SAME_AUTHOR_GAP_MS = 5 * 60 * 1000
/** Runs of >= this many consecutive system messages collapse behind a toggle. */
const COLLAPSE_THRESHOLD = 4

export interface MessageThreadItem {
  kind: 'message'
  msg: MessageItem
  key: string
  /** Previous bubble is the same author within the gap (tighter spacing). */
  sameAuthorPrev: boolean
  /** First bubble of a same-author cluster — show the sender name (groups). */
  firstInCluster: boolean
  /** Last bubble of a same-author cluster — show the sender avatar (groups). */
  lastInCluster: boolean
  /** Show the timestamp (cluster ends after this bubble). */
  showTime: boolean
}

export interface SystemThreadItem {
  /** A single system line, or a collapsed run of them. */
  kind: 'system'
  msgs: ChatBskyConvoDefs.SystemMessageView[]
  collapsed: boolean
  key: string
}

export type ThreadItem = MessageThreadItem | SystemThreadItem

function isSystem(m: MessageItem): boolean {
  return m.$type === SYSTEM
}
function senderDid(m: MessageItem): string | undefined {
  return 'sender' in m ? m.sender?.did : undefined
}
function ts(m: MessageItem): number {
  return 'sentAt' in m ? new Date(m.sentAt).getTime() : 0
}

/**
 * Fold the flat (oldest-first) message list into render units:
 *  - message/deleted views, each carrying its same-author clustering flags;
 *  - system messages, with runs of >= COLLAPSE_THRESHOLD collapsed into one
 *    expandable unit (mirrors upstream's grouped system-message toggle).
 *
 * Clustering keys on sender DID within a 5-minute gap; a system message always
 * breaks a cluster (its neighbors are first/last in their own clusters).
 */
export function buildThreadItems(messages: MessageItem[]): ThreadItem[] {
  const items: ThreadItem[] = []
  let i = 0
  while (i < messages.length) {
    const m = messages[i]

    if (isSystem(m)) {
      let j = i
      while (j < messages.length && isSystem(messages[j])) j++
      const run = messages.slice(i, j) as ChatBskyConvoDefs.SystemMessageView[]
      if (run.length >= COLLAPSE_THRESHOLD) {
        items.push({ kind: 'system', msgs: run, collapsed: true, key: `sysrun-${run[0].id}` })
      } else {
        for (const s of run) items.push({ kind: 'system', msgs: [s], collapsed: false, key: s.id })
      }
      i = j
      continue
    }

    const prev = messages[i - 1]
    const next = messages[i + 1]
    const sd = senderDid(m)
    const sameAuthorPrev =
      !!prev && !isSystem(prev) && senderDid(prev) === sd && Math.abs(ts(m) - ts(prev)) <= SAME_AUTHOR_GAP_MS
    const sameAuthorNext =
      !!next && !isSystem(next) && senderDid(next) === sd && Math.abs(ts(next) - ts(m)) <= SAME_AUTHOR_GAP_MS

    items.push({
      kind: 'message',
      msg: m,
      key: 'id' in m && m.id ? m.id : `msg-${i}`,
      sameAuthorPrev,
      firstInCluster: !sameAuthorPrev,
      lastInCluster: !sameAuthorNext,
      showTime: !sameAuthorNext,
    })
    i++
  }
  return items
}
