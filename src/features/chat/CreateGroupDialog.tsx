import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar, Button, Dialog } from '@/components'
import { normalizeXrpcError } from '@/lib/api/errors'
import { useChatStore } from '@/store/chat-store'
import { useTypeahead } from '@/features/search/use-typeahead'
import { useCreateGroup } from './use-create-group'
import { useChatStatus } from './use-chat-status'

const MAX_NAME = 100

type Picked = Pick<AppBskyActorDefs.ProfileViewBasic, 'did' | 'handle' | 'displayName' | 'avatar'>

/**
 * Create-group flow: pick members (actor typeahead, multi-select) + a name, then
 * createGroup and navigate into the new convo. Globally mounted (RootLayout) and
 * driven by chat-store so any surface can open it. The server adds the creator,
 * so one selected member is the minimum.
 */
export function CreateGroupDialog() {
  const open = useChatStore((s) => s.createGroupOpen)
  const close = useChatStore((s) => s.closeCreateGroup)
  const navigate = useNavigate()
  const create = useCreateGroup()
  const { groupMemberLimit } = useChatStatus()

  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Picked[]>([])

  const { actors } = useTypeahead(query)
  const pickedDids = useMemo(() => new Set(picked.map((p) => p.did)), [picked])
  // selected + creator must fit the limit; 0 means status not yet loaded.
  const atLimit = groupMemberLimit > 0 && picked.length + 1 >= groupMemberLimit
  const results = actors.filter((a) => !pickedDids.has(a.did))

  const reset = () => {
    setName('')
    setQuery('')
    setPicked([])
  }
  const onClose = () => {
    reset()
    close()
  }

  const add = (a: Picked) => {
    if (atLimit) return
    setPicked((p) => [...p, a])
    setQuery('')
  }
  const remove = (did: string) => setPicked((p) => p.filter((x) => x.did !== did))

  const canSubmit = name.trim().length > 0 && picked.length > 0 && !create.isPending
  const submit = () => {
    if (!canSubmit) return
    create.mutate(
      { name: name.trim(), members: picked.map((p) => p.did) },
      {
        onSuccess: (convo) => {
          onClose()
          navigate(`/messages/${convo.id}`)
        },
      },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title="New group chat">
      <div className="group-create">
        <label className="group-create__field">
          <span className="group-create__label">Group name</span>
          <input
            className="group-create__input"
            value={name}
            maxLength={MAX_NAME}
            placeholder="e.g. Weekend plans"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>

        {picked.length > 0 && (
          <div className="group-create__chips">
            {picked.map((p) => (
              <button
                key={p.did}
                type="button"
                className="group-create__chip"
                onClick={() => remove(p.did)}
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
          <span className="group-create__label">
            Add people{atLimit ? ` · limit reached (${groupMemberLimit})` : ''}
          </span>
          <input
            className="group-create__input"
            value={query}
            placeholder="Search people…"
            disabled={atLimit}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {query.trim().length > 0 && results.length > 0 && (
          <div className="group-create__results" role="listbox">
            {results.map((a) => (
              <button key={a.did} type="button" className="group-create__result" onClick={() => add(a)}>
                <Avatar src={a.avatar} alt={a.displayName ?? a.handle} fallback={a.displayName ?? a.handle} size="sm" />
                <span className="group-create__result-name">
                  <strong>{a.displayName?.trim() || a.handle}</strong>
                  <span className="group-create__result-handle">@{a.handle}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {create.isError && (
          <div className="group-create__error" role="alert">
            {normalizeXrpcError(create.error).message}
          </div>
        )}

        <div className="group-create__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={create.isPending} disabled={!canSubmit} onClick={submit}>
            Create group
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
