import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { Avatar, Button, Dialog, Spinner } from '@/components'
import { useAddMember } from './use-list-membership'

interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
  listUri: string
  /** DIDs already in the list, to disable re-adding. */
  existingDids: Set<string>
}

/**
 * Typeahead actor search + one-tap add to the list.
 *
 * Uses searchActorsTypeahead (fast, cursorless). Adding creates a listitem; the
 * parent's useList query is invalidated by the mutation so the new member shows.
 */
export function AddMemberDialog({ open, onClose, listUri, existingDids }: AddMemberDialogProps) {
  const { agent } = useAgent()
  const [q, setQ] = useState('')
  const addMember = useAddMember()
  const [pendingDid, setPendingDid] = useState<string | null>(null)

  const search = useQuery({
    queryKey: qk.searchActors(q),
    enabled: open && q.trim().length > 0,
    queryFn: () =>
      agent.app.bsky.actor
        .searchActorsTypeahead({ q: q.trim(), limit: 8 })
        .then((r) => r.data.actors),
  })

  const handleAdd = (did: string) => {
    setPendingDid(did)
    addMember.mutate(
      { listUri, subjectDid: did },
      { onSettled: () => setPendingDid(null) },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add to list">
      <div className="list-form__field">
        <input
          className="list-form__input"
          placeholder="Search people…"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="add-member__results">
        {search.isLoading && (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
            <Spinner />
          </div>
        )}
        {search.data?.map((actor) => {
          const already = existingDids.has(actor.did)
          return (
            <div key={actor.did} className="add-member__row">
              <Avatar src={actor.avatar} alt={actor.displayName || actor.handle} size="sm" />
              <div className="add-member__row-body">
                <div className="member-row__name">{actor.displayName || actor.handle}</div>
                <div className="member-row__handle">@{actor.handle}</div>
              </div>
              <Button
                size="sm"
                variant={already ? 'secondary' : 'primary'}
                disabled={already}
                loading={pendingDid === actor.did}
                onClick={() => handleAdd(actor.did)}
              >
                {already ? 'Added' : 'Add'}
              </Button>
            </div>
          )
        })}
        {q.trim() && !search.isLoading && search.data?.length === 0 && (
          <div style={{ padding: 'var(--space-4)', color: 'var(--text-muted)' }}>
            No people found.
          </div>
        )}
      </div>
    </Dialog>
  )
}
