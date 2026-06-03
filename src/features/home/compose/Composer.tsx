import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, CounterRing, Icons, RichText } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useComposerText, onComposerKeyDown } from '@/lib/compose'
import { useCreatePost, type PendingImage } from './use-create-post'
import type { ComposeTarget } from '@/store/compose-store'
import './composer.css'

const MAX_IMAGES = 4

interface ComposerProps {
  target: ComposeTarget
  onPosted: () => void
}

/**
 * The compose body: avatar + facet-highlighted textarea + char-counter ring +
 * image attachments with alt text + reply/quote context. Posting goes through
 * useCreatePost (detectFacets -> uploadBlob -> createRecord).
 */
export function Composer({ target, onPosted }: ComposerProps) {
  const { handle, avatar } = useAgent()
  const { text, setText, count, over, isEmptyText, max } = useComposerText()
  const [images, setImages] = useState<PendingImage[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const create = useCreatePost()

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => images.forEach((i) => URL.revokeObjectURL(i.url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    taRef.current?.focus()
  }, [])

  const empty = isEmptyText && images.length === 0
  const canPost = !empty && !over && !create.isPending

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

  // Paste an image straight into the composer (Ctrl/Cmd+V). Only swallow the
  // paste when it actually carries an image, so pasting text still works.
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files
    if (files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
      e.preventDefault()
      addFiles(files)
    }
  }

  const removeImage = (idx: number) => {
    setImages((cur) => {
      const img = cur[idx]
      if (img) URL.revokeObjectURL(img.url)
      return cur.filter((_, i) => i !== idx)
    })
  }

  const setAlt = (idx: number, alt: string) =>
    setImages((cur) => cur.map((img, i) => (i === idx ? { ...img, alt } : img)))

  const submit = () => {
    if (!canPost) return
    create.mutate(
      { text, images, target },
      {
        onSuccess: () => {
          images.forEach((i) => URL.revokeObjectURL(i.url))
          onPosted()
        },
      },
    )
  }

  const onKeyDown = onComposerKeyDown(submit)

  return (
    <div className="composer">
      {target.replyTo && (
        <div className="composer__context">
          Replying to{' '}
          <span className="composer__context-name">
            {target.replyTo.author.displayName || `@${target.replyTo.author.handle}`}
          </span>
        </div>
      )}

      <div className="composer__row">
        <Avatar size="md" src={avatar} fallback={handle?.charAt(0)} alt={handle} />
        <div className="composer__main">
          {/* Facet-highlight preview layered behind the textarea: the textarea
              text is transparent-caret-visible; the preview shows blue links. */}
          <div className="composer__editor">
            <div className="composer__highlight" aria-hidden>
              <RichText text={text} />
              {/* trailing newline keeps the highlight box height in sync */}
              {'​'}
            </div>
            <textarea
              ref={taRef}
              className="composer__textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={target.replyTo ? 'Write your reply' : "What's up?"}
              rows={3}
            />
          </div>

          {images.length > 0 && (
            <div className="composer__images">
              {images.map((img, i) => (
                <div className="composer__image" key={img.url}>
                  <img src={img.url} alt={img.alt || 'attachment preview'} />
                  <button
                    type="button"
                    className="composer__image-remove"
                    aria-label="Remove image"
                    onClick={() => removeImage(i)}
                  >
                    <Icons.CloseIcon size={16} />
                  </button>
                  <input
                    className="composer__alt"
                    placeholder="Alt text"
                    value={img.alt}
                    onChange={(e) => setAlt(i, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {target.quote && (
            <div className="composer__quote">
              <div className="composer__quote-author">
                {target.quote.author.displayName || `@${target.quote.author.handle}`}
              </div>
              <QuotePreview post={target.quote} />
            </div>
          )}
        </div>
      </div>

      {create.isError && (
        <div className="composer__error">
          {(create.error as Error)?.message ?? 'Failed to post. Try again.'}
        </div>
      )}

      <div className="composer__footer">
        <div className="composer__tools">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="composer__tool"
            aria-label="Add image"
            disabled={images.length >= MAX_IMAGES}
            onClick={() => fileRef.current?.click()}
          >
            <Icons.HashIcon size={20} />
          </button>
        </div>

        <div className="composer__post">
          <CounterRing count={count} max={max} />
          <Button onClick={submit} disabled={!canPost} loading={create.isPending}>
            {target.replyTo ? 'Reply' : 'Post'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function QuotePreview({ post }: { post: { record?: unknown } }) {
  const rec = post.record as { text?: string; facets?: never } | undefined
  if (!rec?.text) return null
  return (
    <div className="composer__quote-text">
      <RichText text={rec.text} />
    </div>
  )
}

