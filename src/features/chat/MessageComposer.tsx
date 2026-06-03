import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { IconButton } from '@/components'
import { normalizeXrpcError } from '@/lib/api/errors'
import { useSendMessage } from './use-send-message'

export interface MessageComposerProps {
  convoId: string
  disabled?: boolean
}

/**
 * Bottom composer: auto-growing textarea, Enter-to-send (Shift+Enter newline),
 * inline error on send failure. Send is disabled while in flight or empty.
 */
export function MessageComposer({ convoId, disabled }: MessageComposerProps) {
  const [text, setText] = useState('')
  const send = useSendMessage(convoId)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const grow = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const value = text.trim()
    if (!value || send.isPending || disabled) return
    send.mutate(value, {
      onSuccess: () => {
        setText('')
        requestAnimationFrame(grow)
      },
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form className="msg-composer" onSubmit={submit}>
      {send.isError && (
        <div className="msg-composer__error" role="alert">
          {normalizeXrpcError(send.error).message}
        </div>
      )}
      <div className="msg-composer__row">
        <textarea
          ref={taRef}
          className="msg-composer__input"
          placeholder={disabled ? 'You can’t reply to this conversation' : 'Start a message'}
          value={text}
          disabled={disabled}
          rows={1}
          onChange={(e) => {
            setText(e.target.value)
            grow()
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
