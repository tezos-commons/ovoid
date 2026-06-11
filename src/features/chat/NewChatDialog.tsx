import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar, Button, Dialog } from '@/components'
import { normalizeXrpcError } from '@/lib/api/errors'
import { useChatStore } from '@/store/chat-store'
import { useTypeahead } from '@/features/search/use-typeahead'
import { useCreateGroup } from './use-create-group'
import { useStartConvo } from './use-start-convo'
import { useChatStatus } from './use-chat-status'
import { groupEligibility, profileLabel } from './chat-eligibility'

const MAX_NAME = 100

// Keep the full profile (associated.chat + viewer) so group eligibility can be
// checked locally — not just the display fields.
type Picked = AppBskyActorDefs.ProfileViewBasic

/**
 * Unified "new chat" flow: pick people via actor typeahead.
 *  - exactly one person  -> open the 1:1 DM (getConvoForMembers, idempotent).
 *  - two or more people  -> create a group (requires a name + canCreateGroups).
 * Globally mounted (RootLayout), driven by chat-store so any surface can open it.
 */
export function NewChatDialog() {
  const open = useChatStore((s) => s.newChatOpen)
  const close = useChatStore((s) => s.closeNewChat)
  const navigate = useNavigate()
  const createGroup = useCreateGroup()
  const startConvo = useStartConvo()
  const { groupMemberLimit, canCreateGroups, chatDisabled } = useChatStatus()

  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Picked[]>([])

  const { actors } = useTypeahead(query)
  const pickedDids = useMemo(() => new Set(picked.map((p) => p.did)), [picked])
  const results = actors.filter((a) => !pickedDids.has(a.did))

  const isGroup = picked.length >= 2
  const groupAllowed = canCreateGroups && !chatDisabled
  // selected + creator must fit the limit; 0 means status not yet loaded.
  const atLimit = groupMemberLimit > 0 && picked.length + 1 >= groupMemberLimit

  // People who can't be added to a group (their chat declaration forbids it).
  // Only relevant in group mode — a 1:1 is governed by the server's DM policy.
  // Surfacing them by name here pre-empts the opaque "recipient has not enabled
  // being in groups" rejection that names no one.
  const ineligible = useMemo(
    () => (isGroup ? picked.filter((p) => groupEligibility(p) === 'no') : []),
    [isGroup, picked],
  )

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

  const pending = createGroup.isPending || startConvo.isPending
  const canSubmit =
    !pending &&
    picked.length > 0 &&
    (isGroup ? groupAllowed && name.trim().length > 0 && ineligible.length === 0 : true)

  const submit = () => {
    if (!canSubmit) return
    if (isGroup) {
      createGroup.mutate(
        { name: name.trim(), members: picked.map((p) => p.did) },
        {
          onSuccess: (convo) => {
            onClose()
            navigate(`/messages/${convo.id}`)
          },
        },
      )
    } else {
      startConvo.mutate(picked[0].did, {
        onSuccess: (convoId) => {
          onClose()
          navigate(`/messages/${convoId}`)
        },
      })
    }
  }

  const error = createGroup.error ?? startConvo.error

  return (
    <Dialog open={open} onClose={onClose} title="New chat">
      <div className="group-create">
        {isGroup && (
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
        )}

        {picked.length > 0 && (
          <div className="group-create__chips">
            {picked.map((p) => {
              const blocked = isGroup && groupEligibility(p) === 'no'
              return (
                <button
                  key={p.did}
                  type="button"
                  className={`group-create__chip${blocked ? ' group-create__chip--blocked' : ''}`}
                  onClick={() => remove(p.did)}
                  title={blocked ? 'Can’t be added to group chats — click to remove' : 'Remove'}
                >
                  <Avatar src={p.avatar} alt={p.displayName ?? p.handle} fallback={p.displayName ?? p.handle} size="xs" />
                  <span>{p.displayName?.trim() || `@${p.handle}`}</span>
                  <span aria-hidden="true">×</span>
                </button>
              )
            })}
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
            autoFocus={!isGroup}
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

        {isGroup && !groupAllowed && (
          <div className="group-create__error" role="alert">
            Your account can’t create group chats yet. Pick a single person to start a direct message.
          </div>
        )}

        {ineligible.length > 0 && (
          <div className="group-create__error" role="alert">
            {ineligible.length === 1
              ? `${profileLabel(ineligible[0])} hasn’t enabled group invites and can’t be added. Remove them to continue.`
              : `These people haven’t enabled group invites and can’t be added: ${ineligible
                  .map(profileLabel)
                  .join(', ')}. Remove them to continue.`}
          </div>
        )}

        {error && (
          <div className="group-create__error" role="alert">
            {normalizeXrpcError(error).message}
          </div>
        )}

        <div className="group-create__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={!canSubmit} onClick={submit}>
            {isGroup ? 'Create group' : picked.length === 1 ? 'Message' : 'Next'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
