import { useMemo, useState } from 'react'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar, Button, Dialog } from '@/components'
import { normalizeXrpcError } from '@/lib/api/errors'
import { useTypeahead } from '@/features/search/use-typeahead'
import { useAddGroupMembers } from './use-group-members'

type Picked = Pick<AppBskyActorDefs.ProfileViewBasic, 'did' | 'handle' | 'displayName' | 'avatar'>

export interface AddMembersDialogProps {
  open: boolean
  onClose: () => void
  convoId: string
  /** DIDs already in the group, filtered out of the results. */
  existingDids: ReadonlySet<string>
  /** Remaining capacity (groupMemberLimit - current count); 0 = unknown/no cap. */
  remaining: number
}

/**
 * Owner-only dialog to add members to an existing group (addMembers). Mirrors the
 * create-group picker but scoped to one convo; locally controlled (not the global
 * chat-store) since it only exists inside the settings screen.
 */
export function AddMembersDialog({ open, onClose, convoId, existingDids, remaining }: AddMembersDialogProps) {
  const add = useAddGroupMembers(convoId)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Picked[]>([])

  const { actors } = useTypeahead(query)
  const pickedDids = useMemo(() => new Set(picked.map((p) => p.did)), [picked])
  const results = actors.filter((a) => !pickedDids.has(a.did) && !existingDids.has(a.did))
  const atLimit = remaining > 0 && picked.length >= remaining

  const close = () => {
    setQuery('')
    setPicked([])
    onClose()
  }
  const submit = () => {
    if (picked.length === 0 || add.isPending) return
    add.mutate(
      picked.map((p) => p.did),
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onClose={close} title="Add members">
      <div className="group-create">
        {picked.length > 0 && (
          <div className="group-create__chips">
            {picked.map((p) => (
              <button
                key={p.did}
                type="button"
                className="group-create__chip"
                onClick={() => setPicked((x) => x.filter((m) => m.did !== p.did))}
                title="Remove"
              >
                <Avatar src={p.avatar} alt={p.displayName ?? p.handle} fallback={p.displayName ?? p.handle} size="xs" />
                <span>{p.displayName?.trim() || `@${p.handle}`}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        <label className="group-create__field">
          <span className="group-create__label">{atLimit ? 'Member limit reached' : 'Search people…'}</span>
          <input
            className="group-create__input"
            value={query}
            placeholder="Search people…"
            disabled={atLimit}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {query.trim().length > 0 && results.length > 0 && (
          <div className="group-create__results" role="listbox">
            {results.map((a) => (
              <button
                key={a.did}
                type="button"
                className="group-create__result"
                onClick={() => {
                  if (!atLimit) setPicked((p) => [...p, a])
                  setQuery('')
                }}
              >
                <Avatar src={a.avatar} alt={a.displayName ?? a.handle} fallback={a.displayName ?? a.handle} size="sm" />
                <span className="group-create__result-name">
                  <strong>{a.displayName?.trim() || a.handle}</strong>
                  <span className="group-create__result-handle">@{a.handle}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {add.isError && (
          <div className="group-create__error" role="alert">
            {normalizeXrpcError(add.error).message}
          </div>
        )}

        <div className="group-create__actions">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" loading={add.isPending} disabled={picked.length === 0} onClick={submit}>
            Add {picked.length > 0 ? `(${picked.length})` : ''}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
