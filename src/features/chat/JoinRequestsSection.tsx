import { useEffect } from 'react'
import { Avatar, Button, Spinner } from '@/components'
import {
  useJoinRequests,
  useMarkJoinRequestsRead,
  useResolveJoinRequest,
} from './use-join-requests'

export interface JoinRequestsSectionProps {
  convoId: string
  /** Total pending count from the convo view (owner-only); 0 hides the section. */
  count: number
}

/**
 * Owner-only pending join-request queue. Mounted only when the viewer owns the
 * group and there are requests. Marks the list read on mount (clears the badge),
 * and approves/rejects per row.
 */
export function JoinRequestsSection({ convoId, count }: JoinRequestsSectionProps) {
  const q = useJoinRequests(convoId, count > 0)
  const resolve = useResolveJoinRequest(convoId)
  const markRead = useMarkJoinRequestsRead(convoId)
  const markReadMutate = markRead.mutate

  useEffect(() => {
    if (count > 0) markReadMutate()
  }, [convoId, count, markReadMutate])

  if (count === 0) return null

  return (
    <div className="group-settings__section">
      <div className="group-settings__section-title">Join requests ({count})</div>
      {q.isLoading ? (
        <div className="group-settings__center">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="member-list">
          {q.requests.map((r) => {
            const p = r.requestedBy
            const name = p.displayName?.trim() || p.handle || p.did
            const pending = resolve.isPending && resolve.variables?.member === p.did
            return (
              <div key={p.did} className="member-row">
                <div className="member-row__main">
                  <Avatar src={p.avatar} alt={name} fallback={name} size="sm" />
                  <span className="member-row__name">
                    <strong>{name}</strong>
                    {p.handle && <span className="member-row__handle">@{p.handle}</span>}
                  </span>
                </div>
                <div className="join-req__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => resolve.mutate({ member: p.did, action: 'reject' })}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={pending}
                    onClick={() => resolve.mutate({ member: p.did, action: 'approve' })}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            )
          })}
          {q.hasNextPage && (
            <button
              type="button"
              className="member-list__more"
              onClick={() => q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
            >
              {q.isFetchingNextPage ? 'Loading…' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
