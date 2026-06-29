import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { AppBskyFeedDefs, AppBskyRichtextFacet } from '@atproto/api'
import { Avatar, Button, CounterRing, Icons, RichText } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { haptic } from '@/lib/haptics'
import { onComposerKeyDown } from '@/lib/compose'
import { graphemeCount, MAX_GRAPHEMES } from '@/lib/facets'
import {
  useCreateThread,
  ThreadPartialError,
  type PendingImage,
  type DraftPost,
} from './use-create-post'
import type { ComposeTarget } from '@/store/compose-store'
import './composer.css'

const MAX_IMAGES = 4

/** A composer draft carries a stable id so add/remove preserves identity (and
 *  thus focus/selection) across the array — a positional key would remount the
 *  textarea on every sibling change. */
interface DraftEntry extends DraftPost {
  id: string
}

interface ComposerProps {
  target: ComposeTarget
  onPosted: () => void
}

/**
 * The compose body: avatar + facet-highlighted textarea + char-counter ring +
 * image attachments with alt text + reply/quote context. A thread is one or
 * more drafts; posting creates them as an AT Protocol reply chain via
 * useCreateThread (post N+1 references post N's uri/cid, so creation is
 * sequential). Each draft is a memoized ComposerDraft whose callbacks are all
 * stable, so a keystroke in one draft updates only that draft — siblings keep
 * their focus and selection.
 */
export function Composer({ target, onPosted }: ComposerProps) {
  const { handle, avatar } = useAgent()
  const [drafts, setDrafts] = useState<DraftEntry[]>(() => [{ id: 'd0', text: '', images: [] }])
  const create = useCreateThread()
  const idSeq = useRef(0)
  const [sentCount, setSentCount] = useState<number | null>(null)

  // nextId: stable id generator for new drafts.
  const nextId = useCallback(() => `d${++idSeq.current}`, [])

  const addDraft = useCallback(() => {
    setDrafts((cur) => [...cur, { id: nextId(), text: '', images: [] }])
  }, [nextId])

  const updateDraft = useCallback((id: string, patch: Partial<DraftPost>) => {
    setDrafts((cur) => cur.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }, [])

  const removeDraft = useCallback((id: string) => {
    setDrafts((cur) => {
      // Never leave the composer with zero drafts.
      if (cur.length <= 1) return cur
      return cur.filter((d) => d.id !== id)
    })
  }, [])

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => drafts.forEach((d) => d.images.forEach((i) => URL.revokeObjectURL(i.url)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // submit reads the latest drafts/target/isPending via refs so its identity is
  // stable — that's what keeps ComposerDraft memoized across keystrokes (an
  // inline submit closing over `drafts` would change per keystroke and re-render
  // every draft). mutate is stable from React Query; the ref just dodges the
  // per-render `create` object identity.
  const stateRef = useRef({ drafts, target, onPosted })
  stateRef.current = { drafts, target, onPosted }
  const mutateRef = useRef(create.mutate)
  mutateRef.current = create.mutate
  const pendingRef = useRef(create.isPending)
  pendingRef.current = create.isPending

  const submit = useCallback(() => {
    if (pendingRef.current) return
    const { drafts, target, onPosted } = stateRef.current
    // Keep a draft if it has text, images, or is the quote-only first post (a
    // text-less quote-repost is valid, mirroring Bluesky). Drop bare empty ones.
    const posts = drafts
      .filter(
        (d, i) =>
          d.text.trim().length > 0 || d.images.length > 0 || (i === 0 && !!target.quote),
      )
      .map(({ text, images }) => ({ text, images }))
    if (posts.length === 0) return
    mutateRef.current(
      { posts, target },
      {
        onSuccess: (_data, vars) => {
          haptic('success')
          vars.posts.forEach((d) => d.images.forEach((i) => URL.revokeObjectURL(i.url)))
          onPosted()
        },
        onError: (err) => {
          // Partial thread: posts [0, sentCount) were created on the repo. Trim
          // them so a retry sends only the remainder — re-sending the whole batch
          // would duplicate what already landed.
          if (err instanceof ThreadPartialError) setSentCount(err.sentCount)
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After a partial failure, drop the sent drafts and reset for retry.
  useEffect(() => {
    if (sentCount === null) return
    setDrafts((cur) => {
      const remaining = cur.slice(sentCount)
      return remaining.length > 0 ? remaining : [{ id: nextId(), text: '', images: [] }]
    })
    setSentCount(null)
  }, [sentCount, nextId])

  const onKeyDown = useCallback(onComposerKeyDown(submit), [submit])

  // A quote embed alone is a valid first post; only a bare text+image-less
  // first draft blocks posting. Later drafts may be empty (dropped on send).
  const firstEmpty =
    drafts[0].text.trim().length === 0 && drafts[0].images.length === 0 && !target.quote
  const canPost = !firstEmpty && !create.isPending

  return (
    <div className="composer" data-draft-count={drafts.length}>
      {target.replyTo && <ReplyToPreview post={target.replyTo} />}

      <div className="composer__thread">
        {drafts.map((draft, idx) => (
          <ComposerDraft
            key={draft.id}
            draft={draft}
            handle={handle}
            avatar={avatar}
            target={target}
            draftIndex={idx}
            draftCount={drafts.length}
            canRemove={drafts.length > 1}
            showAvatar={idx === 0}
            autoFocus={idx === 0}
            updateDraft={updateDraft}
            removeDraft={removeDraft}
            onKeyDown={onKeyDown}
          />
        ))}
      </div>

      {create.isError && (
        <div className="composer__error">
          {create.error instanceof ThreadPartialError
            ? `Posted ${create.error.sentCount}, then: ${create.error.cause instanceof Error ? create.error.cause.message : 'failed'}`
            : (create.error as Error)?.message ?? 'Failed to post. Try again.'}
        </div>
      )}

      <div className="composer__footer">
        <div className="composer__tools">
          <button
            type="button"
            className="composer__add-thread"
            aria-label="Add another post to the thread"
            onClick={addDraft}
            disabled={create.isPending}
          >
            <Icons.PlusIcon size={20} />
          </button>
        </div>

        <div className="composer__post">
          <Button onClick={submit} disabled={!canPost} loading={create.isPending}>
            {target.replyTo ? 'Reply' : drafts.length > 1 ? `Post all ${drafts.length}` : 'Post'}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ComposerDraftProps {
  draft: DraftEntry
  handle?: string
  avatar?: string
  target: ComposeTarget
  draftIndex: number
  draftCount: number
  canRemove: boolean
  showAvatar: boolean
  autoFocus: boolean
  updateDraft: (id: string, patch: Partial<DraftPost>) => void
  removeDraft: (id: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

/**
 * One post in a (possibly multi-post) thread. memo'd so a keystroke in one draft
 * updates only that draft — siblings keep their textarea focus and selection.
 * Every callback prop is stable from the parent (updateDraft/removeDraft via
 * useCallback, onKeyDown via a ref-backed submit); only `draft` changes on edit,
 * and `draftIndex`/`draftCount` on add/remove.
 */
const ComposerDraft = memo(function ComposerDraft({
  draft,
  handle,
  avatar,
  target,
  draftIndex,
  draftCount,
  canRemove,
  showAvatar,
  autoFocus,
  updateDraft,
  removeDraft,
  onKeyDown,
}: ComposerDraftProps) {
  const { text, images } = draft
  const count = graphemeCount(text)
  // A quote embed alone is a valid post (text-less quote-repost), mirroring
  // Bluesky — so an empty quote is postable; only a bare text+image-less draft
  // is "empty". Whether the *thread* is postable is decided by the parent's
  // firstEmpty; the per-draft counter just reflects this draft's count.

  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFocus) taRef.current?.focus()
  }, [autoFocus])

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      const room = MAX_IMAGES - images.length
      const next: PendingImage[] = []
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith('image/')) continue
        next.push({ file, url: URL.createObjectURL(file), alt: '' })
      }
      if (next.length) updateDraft(draft.id, { images: [...images, ...next] })
    },
    [draft.id, images, updateDraft],
  )

  // Paste an image straight into the composer (Ctrl/Cmd+V). Only swallow the
  // paste when it actually carries an image, so pasting text still works.
  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = e.clipboardData?.files
      if (files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
        e.preventDefault()
        addFiles(files)
      }
    },
    [addFiles],
  )

  const removeImage = useCallback(
    (idx: number) => {
      const img = images[idx]
      if (img) URL.revokeObjectURL(img.url)
      updateDraft(draft.id, { images: images.filter((_, i) => i !== idx) })
    },
    [draft.id, images, updateDraft],
  )

  const setAlt = useCallback(
    (idx: number, alt: string) =>
      updateDraft(draft.id, { images: images.map((img, i) => (i === idx ? { ...img, alt } : img)) }),
    [draft.id, images, updateDraft],
  )

  return (
    <div className="composer__row">
      {showAvatar ? (
        <Avatar size="md" src={avatar} fallback={handle?.charAt(0)} alt={handle} />
      ) : (
        <div className="composer__thread-tick" aria-hidden />
      )}
      <div className="composer__main">
        {/* Facet-highlight preview layered behind the textarea: the textarea
            text is transparent-caret-visible; the preview shows blue links. */}
        <div className="composer__editor">
          <div className="composer__highlight" ref={highlightRef} aria-hidden>
            <RichText text={text} />
            {/* trailing newline keeps the highlight box height in sync */}
            {'​'}
          </div>
          <textarea
            ref={taRef}
            className="composer__textarea"
            value={text}
            onChange={(e) => updateDraft(draft.id, { text: e.target.value })}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onScroll={(e) => {
              // The textarea is the only layer that scrolls; mirror its scroll
              // into the highlight so the facet coloring tracks the visible text
              // instead of staying pinned at offset 0.
              const ta = e.currentTarget
              const hl = highlightRef.current
              if (hl) {
                hl.scrollTop = ta.scrollTop
                hl.scrollLeft = ta.scrollLeft
              }
            }}
            placeholder={target.replyTo && draftIndex === 0 ? 'Write your reply' : "What's up?"}
            rows={3}
          />
        </div>

        {images.length > 0 && (
          <div className="composer__images" data-count={images.length}>
            {images.map((img, i) => (
              <div className="composer__image" key={img.url}>
                <div className="composer__image-frame">
                  <img src={img.url} alt={img.alt || 'attachment preview'} />
                  <button
                    type="button"
                    className="composer__image-remove"
                    aria-label="Remove image"
                    onClick={() => removeImage(i)}
                  >
                    <Icons.CloseIcon size={16} />
                  </button>
                  {img.alt.trim() && <span className="composer__image-altbadge">ALT</span>}
                </div>
                <input
                  className="composer__alt"
                  placeholder="Add alt text…"
                  value={img.alt}
                  onChange={(e) => setAlt(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        {target.quote && draftIndex === 0 && (
          <div className="composer__quote">
            <div className="composer__quote-author">
              {target.quote.author.displayName || `@${target.quote.author.handle}`}
            </div>
            <QuotePreview post={target.quote} />
          </div>
        )}

        <div className="composer__draft-meta">
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
            <Icons.ImageIcon size={20} />
          </button>
          {draftCount > 1 && (
            <span className="composer__draft-index">
              {draftIndex + 1}/{draftCount}
            </span>
          )}
          <CounterRing count={count} max={MAX_GRAPHEMES} />
          {canRemove && (
            <button
              type="button"
              className="composer__draft-remove"
              aria-label="Remove this post from the thread"
              onClick={() => removeDraft(draft.id)}
            >
              <Icons.CloseIcon size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

/**
 * The post being replied to, shown above the reply input (avatar + author + the
 * post text, clamped), then a "Replying to @handle" line — mirroring the native
 * Bluesky reply sheet so the context is visible while composing.
 */
function ReplyToPreview({ post }: { post: AppBskyFeedDefs.PostView }) {
  const rec = post.record as { text?: string; facets?: AppBskyRichtextFacet.Main[] } | undefined
  const a = post.author
  return (
    <div className="composer__replyto">
      <div className="composer__replyto-post">
        <Avatar size="sm" src={a.avatar} fallback={a.handle?.charAt(0)} alt={a.handle} />
        <div className="composer__replyto-body">
          <div className="composer__replyto-author">
            <span className="composer__replyto-name">{a.displayName || a.handle}</span>
            <span className="composer__replyto-handle">@{a.handle}</span>
          </div>
          {rec?.text && (
            <div className="composer__replyto-text">
              <RichText text={rec.text} facets={rec.facets} />
            </div>
          )}
        </div>
      </div>
      <div className="composer__context">
        Replying to <span className="composer__context-name">@{a.handle}</span>
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
