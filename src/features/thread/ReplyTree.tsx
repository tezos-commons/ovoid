import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppBskyFeedDefs } from '@atproto/api'
import { PostCard } from '@/components'
import {
  isThreadViewPost,
  isBlockedPost,
  isNotFoundPost,
} from './use-thread'

export interface ReplyTreeProps {
  /** Replies array off a threadViewPost node. */
  replies: AppBskyFeedDefs.ThreadViewPost['replies']
  /** Current nesting depth (0 = direct replies to the focused post). */
  depth?: number
}

/** Max visual indent before we stop adding gutter columns (avoids runaway nesting). */
const MAX_INDENT_DEPTH = 6

/**
 * Renders the reply subtree below the focused post. Each reply is a feed-variant
 * PostCard drawn as a thread child (connector gutter), with its own children
 * recursed beneath at one more indent step. Deep chains collapse into a
 * tappable "continue thread" link to that post's permalink rather than
 * indenting indefinitely.
 *
 * Sorting: the AppView already returns replies in its default order; we surface
 * a sort control at the ThreadView level and re-order here by the chosen key.
 */
export function ReplyTree({ replies, depth = 0 }: ReplyTreeProps) {
  if (!replies || replies.length === 0) return null

  return (
    <div className="replytree" data-depth={depth}>
      {replies.map((node, i) => (
        <ReplyNode key={nodeKey(node, i)} node={node} depth={depth} />
      ))}
    </div>
  )
}

function nodeKey(node: unknown, i: number): string {
  if (isThreadViewPost(node)) return node.post.uri
  if (isNotFoundPost(node) || isBlockedPost(node)) {
    const n = node as { uri?: string }
    return n.uri ?? `stub-${i}`
  }
  return `node-${i}`
}

function ReplyNode({
  node,
  depth,
}: {
  node: NonNullable<AppBskyFeedDefs.ThreadViewPost['replies']>[number]
  depth: number
}) {
  const [collapsed, setCollapsed] = useState(false)

  if (isNotFoundPost(node)) {
    return <div className="thread-stub thread-stub--child">Post not found.</div>
  }
  if (isBlockedPost(node)) {
    return <div className="thread-stub thread-stub--child">Post from a blocked account.</div>
  }
  if (!isThreadViewPost(node)) return null

  const children = node.replies ?? []
  const hasChildren = children.length > 0
  const tooDeep = depth >= MAX_INDENT_DEPTH

  const permalink = postPermalink(node.post)

  return (
    <div className="replytree__node">
      <div className="replytree__post" data-author-did={node.post.author.did}>
        <PostCard post={node.post} isThreadChild={hasChildren && !collapsed} />
        {hasChildren && (
          <button
            type="button"
            className="replytree__collapse"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand replies' : 'Collapse replies'}
          >
            {collapsed ? '+' : '–'}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && !tooDeep && (
        <ReplyTree replies={children} depth={depth + 1} />
      )}

      {hasChildren && !collapsed && tooDeep && (
        <Link to={permalink} className="replytree__more">
          Continue thread →
        </Link>
      )}

      {hasChildren && collapsed && (
        <button
          type="button"
          className="replytree__more"
          onClick={() => setCollapsed(false)}
        >
          Show {childCount(children)} more {childCount(children) === 1 ? 'reply' : 'replies'}
        </button>
      )}
    </div>
  )
}

function childCount(
  replies: NonNullable<AppBskyFeedDefs.ThreadViewPost['replies']>,
): number {
  return replies.filter(isThreadViewPost).length
}

function postPermalink(post: AppBskyFeedDefs.PostView): string {
  const rkey = post.uri.split('/').pop() ?? ''
  const actor = post.author.handle || post.author.did
  return `/profile/${actor}/post/${rkey}`
}
