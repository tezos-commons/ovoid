import { useState } from 'react'
import { Dialog } from '@/components/Dialog'
import type { PollKind, PollVisibility } from '@/lib/poll/client'
import { useCreatePoll } from './use-poll'
import './create-poll.css'

const MAX_OPTIONS = 8

export interface CreatePollDialogProps {
  open: boolean
  onClose: () => void
  /** Called with the new poll's id after a successful create. */
  onCreated: (id: string) => void
}

/** Compose a poll, create it on the service, and hand back its id to share. */
export function CreatePollDialog({ open, onClose, onCreated }: CreatePollDialogProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [kind, setKind] = useState<PollKind>('single')
  const [visibility, setVisibility] = useState<PollVisibility>('public')
  const create = useCreatePoll()

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean)
  const valid = question.trim().length > 0 && cleanOptions.length >= 2

  const reset = () => {
    setQuestion('')
    setOptions(['', ''])
    setKind('single')
    setVisibility('public')
  }

  const submit = () => {
    if (!valid || create.isPending) return
    create.mutate(
      { question: question.trim(), kind, options: cleanOptions, visibility },
      {
        onSuccess: ({ id }) => {
          reset()
          onCreated(id)
        },
      },
    )
  }

  const setOpt = (i: number, v: string) =>
    setOptions((s) => s.map((o, idx) => (idx === i ? v : o)))
  const addOpt = () => setOptions((s) => (s.length < MAX_OPTIONS ? [...s, ''] : s))
  const removeOpt = (i: number) =>
    setOptions((s) => (s.length > 2 ? s.filter((_, idx) => idx !== i) : s))

  return (
    <Dialog open={open} onClose={onClose} title="Create poll">
      <div className="pollform">
        <input
          className="pollform__q"
          placeholder="Ask a question"
          value={question}
          maxLength={300}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <div className="pollform__opts">
          {options.map((o, i) => (
            <div className="pollform__opt" key={i}>
              <input
                placeholder={`Option ${i + 1}`}
                value={o}
                maxLength={100}
                onChange={(e) => setOpt(i, e.target.value)}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="pollform__rm"
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => removeOpt(i)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button type="button" className="pollform__add" onClick={addOpt}>
              + Add option
            </button>
          )}
        </div>

        <div className="pollform__row">
          <label className="pollform__field">
            <span>Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as PollKind)}>
              <option value="single">Pick one</option>
              <option value="multi">Pick any</option>
              <option value="ranked">Ranked choice</option>
            </select>
          </label>
          <label className="pollform__field">
            <span>Results</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PollVisibility)}
            >
              <option value="public">Visible after voting</option>
              <option value="private">Hidden until closed</option>
            </select>
          </label>
        </div>

        {create.error && <div className="pollform__error">{create.error.message}</div>}

        <button
          type="button"
          className="pollform__submit"
          disabled={!valid || create.isPending}
          onClick={submit}
        >
          {create.isPending ? 'Creating…' : 'Create poll'}
        </button>
      </div>
    </Dialog>
  )
}
