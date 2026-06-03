import { useEffect, useRef, useState } from 'react'
import type { AppBskyFeedDefs } from '@atproto/api'
import { Avatar, Button, CounterRing, Icons } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useComposerText, onComposerKeyDown } from '@/lib/compose'
import { useReply } from './use-reply'
import type { PendingImage } from '@/features/home/compose/use-create-post'

const MAX_IMAGES = 4

export interface ReplyComposerProps {
  /** The post this composer replies to (the focused thread post). */
  parent: AppBskyFeedDefs.PostView
}

/**
 * Inline reply composer pinned under the focused post. Grapheme-counted (300
 * cap, matching the post text limit), with a thin progress ring like Bluesky's
 * composer. Disabled / hidden affordance when signed out — replies are a write
 * and the public agent cannot post.
 */
export function ReplyComposer({ parent }: ReplyComposerProps) {
  const { isAuthed, handle, avatar } = useAgent()
  const reply = useReply()
  const { text, setText, count, over, isEmptyText, max } = useComposerText()
  const [images, setImages] = useState<PendingImage[]>([])
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Revoke preview object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => images.forEach((i) => URL.revokeObjectURL(i.url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isAuthed) {
    return (
      <div className="reply-composer reply-composer--signedout">
        Sign in to reply to this post.
      </div>
    )
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const room = MAX_IMAGES - images.length
    const next: PendingImage[] = []
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith('image/')) continue
      next.push({ file, url: URL.createObjectURL(file), alt: '' })
    }
    if (next.length) setImages((cur) => [...cur, ...next])
  }

  // Paste an image straight into the reply (Ctrl/Cmd+V); leave text pastes alone.
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files
    if (files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
      e.preventDefault()
      addFiles(files)
    }
  }

  const removeImage = (idx: number) =>
    setImages((cur) => {
      const img = cur[idx]
      if (img) URL.revokeObjectURL(img.url)
      return cur.filter((_, i) => i !== idx)
    })

  const empty = isEmptyText && images.length === 0

  const submit = async () => {
    if (empty || over || reply.isPending) return
    try {
      await reply.mutateAsync({ parent, text: text.trim(), images })
      images.forEach((i) => URL.revokeObjectURL(i.url))
      setImages([])
      setText('')
      taRef.current?.blur()
    } catch {
      /* error surfaced below via reply.isError */
    }
  }

  return (
    <div className="reply-composer">
      <div className="reply-composer__row">
        <Avatar size="sm" src={avatar} alt={handle} fallback={(handle ?? '?').charAt(0).toUpperCase()} />
        <textarea
          ref={taRef}
          className="reply-composer__input"
          placeholder="Write your reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onComposerKeyDown(submit)}
          onPaste={onPaste}
          rows={1}
        />
      </div>

      {images.length > 0 && (
        <div className="reply-composer__images">
          {images.map((img, i) => (
            <div className="reply-composer__image" key={img.url}>
              <img src={img.url} alt={img.alt || 'attachment preview'} />
              <button
                type="button"
                className="reply-composer__image-remove"
                aria-label="Remove image"
                onClick={() => removeImage(i)}
              >
                <Icons.CloseIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="reply-composer__footer">
        {reply.isError && (
          <span className="reply-composer__error">
            {(reply.error as Error)?.message ?? 'Could not post reply'}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <CounterRing count={count} max={max} size={28} />
        <Button
          size="sm"
          variant="primary"
          loading={reply.isPending}
          disabled={empty || over}
          onClick={submit}
        >
          Reply
        </Button>
      </div>
    </div>
  )
}
