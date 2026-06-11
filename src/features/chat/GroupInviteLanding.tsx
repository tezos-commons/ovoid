import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Button, Spinner } from '@/components'
import { normalizeXrpcError } from '@/lib/api/errors'
import { useAgent } from '@/lib/api/agent'
import { useJoinLinkPreview, isDisabledPreview, isValidPreview } from './use-join-link-preview'
import { useRequestJoin, useWithdrawJoinRequest } from './use-join-requests'
import './chat.css'

/**
 * Public landing for a group invite link (/group/join/:code). Resolves the code
 * to a preview (works logged-out), then offers a context-aware action: sign in,
 * join / request to join, withdraw a pending request, or open the chat if already
 * a member. Handles the disabled/invalid preview states.
 */
export default function GroupInviteLanding() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { isAuthed } = useAgent()
  const previewQ = useJoinLinkPreview(code)
  const request = useRequestJoin()
  const withdraw = useWithdrawJoinRequest(code)

  const preview = previewQ.data

  return (
    <div className="invite-landing">
      <div className="invite-landing__card">
        {previewQ.isLoading ? (
          <Spinner size="lg" />
        ) : !preview || !isValidPreview(preview) ? (
          <Unavailable disabled={!!preview && isDisabledPreview(preview)} />
        ) : (
          <>
            <Avatar
              src={preview.owner.avatar}
              alt={preview.name}
              fallback={preview.name}
              size="xl"
              shape="rounded-square"
            />
            <h1 className="invite-landing__name">{preview.name}</h1>
            <div className="invite-landing__meta">
              {preview.memberCount} members · invited by{' '}
              {preview.owner.displayName?.trim() || `@${preview.owner.handle}`}
            </div>

            {!isAuthed ? (
              <Button variant="primary" onClick={() => navigate('/login')}>
                Log in to join
              </Button>
            ) : preview.convo ? (
              <Button variant="primary" onClick={() => navigate(`/messages/${preview.convoId}`)}>
                Open chat
              </Button>
            ) : preview.viewer?.requestedAt ? (
              <Button
                variant="secondary"
                loading={withdraw.isPending}
                onClick={() => withdraw.mutate(preview.convoId)}
              >
                Requested · withdraw
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={request.isPending}
                onClick={() =>
                  request.mutate(code!, {
                    onSuccess: (res) => {
                      if (res.status === 'joined') navigate(`/messages/${preview.convoId}`)
                    },
                  })
                }
              >
                {preview.requireApproval ? 'Request to join' : 'Join group'}
              </Button>
            )}

            {request.isError && (
              <div className="group-create__error" role="alert">
                {normalizeXrpcError(request.error).message}
              </div>
            )}
          </>
        )}
        <button type="button" className="invite-landing__home" onClick={() => navigate('/')}>
          Go to Ovoid
        </button>
      </div>
    </div>
  )
}

function Unavailable({ disabled }: { disabled: boolean }) {
  return (
    <>
      <h1 className="invite-landing__name">Invite unavailable</h1>
      <div className="invite-landing__meta">
        {disabled
          ? 'This invite link has been turned off by the group owner.'
          : 'This invite link is invalid or has expired.'}
      </div>
    </>
  )
}
