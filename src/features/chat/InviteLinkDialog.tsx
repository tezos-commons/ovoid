import { useState } from 'react'
import type { ChatBskyConvoDefs, ChatBskyGroupDefs } from '@atproto/api'
import { Button, Dialog } from '@/components'
import { normalizeXrpcError } from '@/lib/api/errors'
import { groupKind } from './group'
import {
  useCreateJoinLink,
  useDisableJoinLink,
  useEditJoinLink,
  useEnableJoinLink,
} from './use-join-links'

export interface InviteLinkDialogProps {
  open: boolean
  onClose: () => void
  convo: ChatBskyConvoDefs.ConvoView
}

/** Absolute invite URL for a join-link code. */
export function inviteUrl(code: string): string {
  return `${window.location.origin}/group/join/${code}`
}

const RULE_LABELS: Record<string, string> = {
  anyone: 'Anyone with the link',
  followedByOwner: 'Only people you follow',
}

/**
 * Owner-only invite-link management. If no link exists, offers to create one with
 * a join rule + approval requirement; otherwise shows the URL (copy), lets the
 * owner change the rule/approval, and enable/disable the link.
 */
export function InviteLinkDialog({ open, onClose, convo }: InviteLinkDialogProps) {
  const convoId = convo.id
  const link = groupKind(convo)?.joinLink

  return (
    <Dialog open={open} onClose={onClose} title="Invite link">
      <div className="group-create">
        {link ? (
          <ManageLink convoId={convoId} link={link} />
        ) : (
          <CreateLink convoId={convoId} />
        )}
      </div>
    </Dialog>
  )
}

function CreateLink({ convoId }: { convoId: string }) {
  const create = useCreateJoinLink(convoId)
  const [joinRule, setJoinRule] = useState<ChatBskyGroupDefs.JoinRule>('anyone')
  const [requireApproval, setRequireApproval] = useState(false)

  return (
    <>
      <p className="group-settings__meta">
        Create a link people can use to request to join this group.
      </p>
      <RuleSelect value={joinRule} onChange={setJoinRule} />
      <label className="invite__check">
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={(e) => setRequireApproval(e.target.checked)}
        />
        Require your approval to join
      </label>
      {create.isError && (
        <div className="group-create__error" role="alert">
          {normalizeXrpcError(create.error).message}
        </div>
      )}
      <div className="group-create__actions">
        <Button
          variant="primary"
          loading={create.isPending}
          onClick={() => create.mutate({ joinRule, requireApproval })}
        >
          Create link
        </Button>
      </div>
    </>
  )
}

function ManageLink({ convoId, link }: { convoId: string; link: ChatBskyGroupDefs.JoinLinkView }) {
  const edit = useEditJoinLink(convoId)
  const enable = useEnableJoinLink(convoId)
  const disable = useDisableJoinLink(convoId)
  const [copied, setCopied] = useState(false)

  const enabled = link.enabledStatus === 'enabled'
  const url = inviteUrl(link.code)

  const copy = () => {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }

  return (
    <>
      <div className="invite__url">
        <input className="group-create__input" readOnly value={url} onFocus={(e) => e.target.select()} />
        <Button variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <RuleSelect
        value={link.joinRule}
        onChange={(joinRule) => edit.mutate({ joinRule, requireApproval: link.requireApproval })}
      />
      <label className="invite__check">
        <input
          type="checkbox"
          checked={link.requireApproval}
          onChange={(e) => edit.mutate({ joinRule: link.joinRule, requireApproval: e.target.checked })}
        />
        Require your approval to join
      </label>

      {(edit.isError || enable.isError || disable.isError) && (
        <div className="group-create__error" role="alert">
          {normalizeXrpcError(edit.error ?? enable.error ?? disable.error).message}
        </div>
      )}

      <div className="group-create__actions">
        {enabled ? (
          <Button variant="danger" loading={disable.isPending} onClick={() => disable.mutate()}>
            Disable link
          </Button>
        ) : (
          <Button variant="primary" loading={enable.isPending} onClick={() => enable.mutate()}>
            Enable link
          </Button>
        )}
      </div>
    </>
  )
}

function RuleSelect({
  value,
  onChange,
}: {
  value: ChatBskyGroupDefs.JoinRule
  onChange: (v: ChatBskyGroupDefs.JoinRule) => void
}) {
  return (
    <label className="group-create__field">
      <span className="group-create__label">Who can join</span>
      <select
        className="group-create__input"
        value={value}
        onChange={(e) => onChange(e.target.value as ChatBskyGroupDefs.JoinRule)}
      >
        {Object.entries(RULE_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
