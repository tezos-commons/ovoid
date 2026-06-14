import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { Avatar, IconButton } from '@/components'
import { haptic } from '@/lib/haptics'
import { normalizeXrpcError } from '@/lib/api/errors'
import { useAgent } from '@/lib/api/agent'
import { pollUrl } from '@/lib/poll/client'
import { CreatePollDialog } from '@/features/poll/CreatePollDialog'
import { useSendMessage } from './use-send-message'
import {
  findMentionToken,
  useMentionCandidates,
  type MentionCandidate,
  type MentionToken,
} from './MentionSuggest'
import type { ConvoMember } from './group'

export interface MessageComposerProps {
  convoId: string
  disabled?: boolean
  /** Convo roster — first-choice mention suggestions (group members / the DM peer). */
  members?: ConvoMember[]
}

/**
 * Bottom composer: auto-growing textarea, Enter-to-send (Shift+Enter newline),
 * inline error on send failure. Send is disabled while in flight or empty.
 *
 * Typing `@…` opens a mention popover (convo members first, then actor
 * typeahead). While it's open, Enter/Tab accept the highlighted suggestion and
 * arrows move it — Enter only sends when no suggestion list is showing. The
 * inserted @handle becomes a real mention facet in useSendMessage's buildPost.
 */
export function MessageComposer({ convoId, disabled, members = [] }: MessageComposerProps) {
  const [text, setText] = useState('')
  const [token, setToken] = useState<MentionToken | null>(null)
  const [highlight, setHighlight] = useState(0)
  const [pollOpen, setPollOpen] = useState(false)
  const send = useSendMessage(convoId)
  const { did } = useAgent()
  const taRef = useRef<HTMLTextAreaElement>(null)

  const candidates = useMentionCandidates(token, members, did)
  const open = token !== null && candidates.length > 0

  const grow = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const syncToken = (value: string, caret: number) => {
    const next = findMentionToken(value, caret)
    // New token or changed partial → reset the highlight to the top.
    if (next?.start !== token?.start || next?.query !== token?.query) setHighlight(0)
    setToken(next)
  }

  const accept = (candidate: MentionCandidate) => {
    if (!token) return
    const el = taRef.current
    const caret = el?.selectionStart ?? text.length
    const inserted = `@${candidate.handle} `
    setText(text.slice(0, token.start) + inserted + text.slice(caret))
    setToken(null)
    requestAnimationFrame(() => {
      const pos = token.start + inserted.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
      grow()
    })
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const value = text.trim()
    if (!value || send.isPending || disabled) return
    send.mutate(value, {
      onSuccess: () => {
        haptic('success')
        setText('')
        setToken(null)
        requestAnimationFrame(grow)
      },
    })
  }

  // After a poll is created, share it as a message — the link unfurls into the
  // interactive poll card (and is stripped from the bubble text).
  const createdPoll = (id: string) => {
    setPollOpen(false)
    send.mutate(pollUrl(id), { onSuccess: () => haptic('success') })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => (h + 1) % candidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => (h - 1 + candidates.length) % candidates.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        accept(candidates[Math.min(highlight, candidates.length - 1)])
        return
      }
      if (e.key === 'Escape') {
        setToken(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <>
    <form className="msg-composer" onSubmit={submit}>
      {open && (
        <div className="mention-pop" role="listbox" aria-label="Mention suggestions">
          {candidates.map((a, i) => (
            <button
              key={a.did}
              type="button"
              role="option"
              aria-selected={i === highlight}
              className={clsx('mention-pop__item', i === highlight && 'mention-pop__item--active')}
              onMouseEnter={() => setHighlight(i)}
              // mousedown, not click: keeps the textarea from blurring first.
              onMouseDown={(e) => {
                e.preventDefault()
                accept(a)
              }}
            >
              <Avatar src={a.avatar} alt="" fallback={a.displayName || a.handle} size="xs" />
              <span className="mention-pop__name">{a.displayName || a.handle}</span>
              <span className="mention-pop__handle">@{a.handle}</span>
            </button>
          ))}
        </div>
      )}
      {send.isError && (
        <div className="msg-composer__error" role="alert">
          {normalizeXrpcError(send.error).message}
        </div>
      )}
      <div className="msg-composer__row">
        <IconButton
          label="Create poll"
          type="button"
          disabled={disabled}
          className="msg-composer__poll"
          onClick={() => setPollOpen(true)}
        >
          <PollIcon />
        </IconButton>
        <textarea
          ref={taRef}
          className="msg-composer__input"
          placeholder={disabled ? 'You can’t reply to this conversation' : 'Start a message'}
          value={text}
          disabled={disabled}
          rows={1}
          onChange={(e) => {
            setText(e.target.value)
            syncToken(e.target.value, e.target.selectionStart ?? e.target.value.length)
            grow()
          }}
          onClick={(e) => {
            const el = e.currentTarget
            syncToken(el.value, el.selectionStart ?? el.value.length)
          }}
          onKeyDown={onKeyDown}
        />
        <IconButton
          label="Send message"
          type="submit"
          disabled={disabled || send.isPending || text.trim().length === 0}
          className="msg-composer__send"
        >
          <SendIcon />
        </IconButton>
      </div>
    </form>
    <CreatePollDialog open={pollOpen} onClose={() => setPollOpen(false)} onCreated={createdPoll} />
    </>
  )
}

function PollIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M6 20v-6M12 20V4M18 20v-10" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden="true">
      <path
        d="M3.4 20.4 21 12 3.4 3.6 3.39 10.2 15.6 12l-12.21 1.8z"
        fill="currentColor"
      />
    </svg>
  )
}
