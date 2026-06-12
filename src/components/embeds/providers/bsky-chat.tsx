import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../Avatar'
import { Button } from '../../Button'
import type { ExternalEmbedMatcher } from '../external-registry'
import type { ExternalEmbedProps } from '../GenericExternalCard'
import { useAgent } from '@/lib/api/agent'
import { groupInviteCode } from '@/lib/bsky-links'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { runWhenIdle } from '@/lib/idle'
import {
  useJoinLinkPreview,
  isValidPreview,
  isDisabledPreview,
} from '@/features/chat/use-join-link-preview'
import { useRequestJoin } from '@/features/chat/use-join-requests'
import { messagesOptions } from '@/features/chat/use-messages'

// https://bsky.app/chat/<code> — the official app's group invite permalink.
const PATH = /^\/chat\/[A-Za-z0-9_-]+$/

/**
 * Group-chat invite card: group avatar, name, member count and a context-aware
 * action — Join / Request to join, Requested, Open chat (already a member), or
 * a closed notice when the owner disabled the link. The same preview endpoint
 * the invite landing uses is public, so the card renders signed out too (the
 * action then routes through the landing, which handles login).
 *
 * The AppView's external embed carries a title/description fallback for closed
 * invites whose preview no longer resolves; in-text links (chat messages) have
 * no such fallback and render the closed notice alone.
 */
function GroupChatEmbed({ external }: ExternalEmbedProps) {
  const code = groupInviteCode(external.uri)
  const navigate = useNavigate()
  const { isAuthed, chatAgent } = useAgent()
  const previewQ = useJoinLinkPreview(code ?? undefined)
  const request = useRequestJoin()

  const preview = previewQ.data
  const valid = preview && isValidPreview(preview) ? preview : null
  const closed = !!preview && !valid

  // Already a member → the card's action navigates to the convo; warm its
  // messages head page (same factory ConvoList rows use) once we know the id.
  // Effect, not usePrefetchOnVisible: the convoId only exists after the
  // preview resolves, which is itself gated on this card being rendered.
  const memberConvoId = valid?.convo ? valid.convoId : undefined
  useEffect(() => {
    if (!memberConvoId || !chatAgent) return
    runWhenIdle(() => {
      const opts = messagesOptions(chatAgent, memberConvoId)
      schedulePrefetch(opts.queryKey, () => queryClient.prefetchInfiniteQuery(opts))
    })
  }, [memberConvoId, chatAgent])

  // While the preview resolves, show nothing rather than a flash of "closed".
  if (!code || (!preview && previewQ.isLoading)) return null

  const name = valid?.name || external.title || 'Group chat'
  const landing = `/group/join/${code}`

  let action: React.ReactNode = null
  if (valid) {
    if (!isAuthed) {
      action = (
        <Button size="sm" variant="primary" onClick={() => navigate(landing)}>
          Join
        </Button>
      )
    } else if (valid.convo) {
      action = (
        <Button size="sm" variant="primary" onClick={() => navigate(`/messages/${valid.convoId}`)}>
          Open chat
        </Button>
      )
    } else if (valid.viewer?.requestedAt) {
      action = (
        <Button size="sm" variant="secondary" onClick={() => navigate(landing)}>
          Requested
        </Button>
      )
    } else {
      action = (
        <Button
          size="sm"
          variant="primary"
          loading={request.isPending}
          onClick={() =>
            request.mutate(code, {
              onSuccess: (res) => {
                if (res.status === 'joined') navigate(`/messages/${valid.convoId}`)
              },
            })
          }
        >
          {valid.requireApproval ? 'Request to join' : 'Join'}
        </Button>
      )
    }
  }

  return (
    <div className="embed embed--groupchat" onClick={(e) => e.stopPropagation()}>
      <Avatar
        src={valid?.owner.avatar}
        alt={name}
        fallback={name}
        size="md"
        shape="rounded-square"
      />
      <div className="embed-groupchat__body">
        <div className="embed-groupchat__name">{name}</div>
        <div className="embed-groupchat__meta">
          {valid
            ? `${valid.memberCount} members`
            : closed
              ? isDisabledPreview(preview)
                ? 'Invite closed by the group owner'
                : 'Invite invalid or expired'
              : (external.description ?? '')}
        </div>
        {request.isError && <div className="embed-groupchat__error">Couldn’t join — try again</div>}
      </div>
      {action}
    </div>
  )
}

export const bskyChatMatcher: ExternalEmbedMatcher = {
  id: 'bsky-chat',
  test: (url) => /(^|\.)bsky\.app$/.test(url.hostname) && PATH.test(url.pathname),
  Component: GroupChatEmbed,
}
