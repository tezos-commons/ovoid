import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Spinner, EmptyState, Img } from '@/components'
import { blobUrl } from '@/lib/api/repo-read'
import { MarkdownEditor } from './MarkdownEditor'
import {
  usePublicationStudio,
  useEditableDocument,
  useSavePost,
  documentMarkdown,
  slugify,
} from './use-documents'
import './studio.css'
import './editor.css'

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

/**
 * Full-screen post editor (outside the app shell). A clean writing column —
 * title + WYSIWYG body — with a collapsible right panel for post metadata
 * (slug, excerpt, tags). Save writes the `site.standard.document` record.
 */
export default function EditorScreen() {
  const { subdomain, rkey } = useParams<{ subdomain: string; rkey?: string }>()
  const navigate = useNavigate()
  const studio = usePublicationStudio(subdomain)
  const existing = useEditableDocument(studio.did, rkey)
  const save = useSavePost(studio.pubUri, studio.did)

  const isEdit = !!rkey
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [seeded, setSeeded] = useState(!isEdit)
  const [panelOpen, setPanelOpen] = useState(false)
  const getMarkdown = useRef<(() => string) | null>(null)

  useEffect(() => {
    if (seeded || !existing.doc) return
    setTitle(existing.doc.title ?? '')
    setSlug((existing.doc.path ?? '').replace(/^\//, ''))
    setSlugTouched(true)
    setDescription(existing.doc.description ?? '')
    setTags((existing.doc.tags ?? []).join(', '))
    setSeeded(true)
  }, [seeded, existing.doc])

  useEffect(() => {
    if (!slugTouched && title) setSlug(slugify(title))
  }, [title, slugTouched])

  if (studio.notFound) {
    return (
      <div className="studio-app studio-app--center">
        <EmptyState title="Publication not found" action={<Link to="/" className="btn btn--secondary btn--sm">Back to Ovoid</Link>} />
      </div>
    )
  }
  if ((isEdit && existing.isPending) || !seeded) {
    return <div className="studio-loading studio-loading--full"><Spinner size="lg" /></div>
  }

  const canSave = title.trim().length > 0 && slug.length > 0 && !save.isPending

  // Existing cover (when editing) — preserved unless replaced or removed.
  const existingCover =
    existing.data && existing.doc?.coverImage
      ? blobUrl(existing.data.pds, existing.data.did, existing.doc.coverImage.ref.$link)
      : undefined
  const coverPreview = coverFile
    ? URL.createObjectURL(coverFile)
    : coverRemoved
      ? undefined
      : existingCover

  const onSave = () => {
    if (!canSave) return
    save.mutate(
      {
        rkey,
        title,
        slug,
        description,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        markdown: getMarkdown.current?.() ?? '',
        coverFile: coverFile ?? undefined,
        coverImage: coverFile || coverRemoved ? undefined : existing.doc?.coverImage,
        publishedAt: existing.doc?.publishedAt,
      },
      {
        onSuccess: ({ rkey: saved }) => {
          if (!isEdit && saved) navigate(`/studio/${subdomain}/edit/${saved}`, { replace: true })
        },
      },
    )
  }

  return (
    <div className="editor-screen">
      <header className="editor-bar">
        <Link to={`/studio/${subdomain}`} className="editor-bar__back">
          <BackIcon /> Posts
        </Link>
        <div className="editor-bar__right">
          {isEdit && studio.did && rkey && (
            <Link to={`/read/${studio.did}/${rkey}`} className="btn btn--ghost btn--sm">View</Link>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPanelOpen((v) => !v)}
            aria-pressed={panelOpen}
          >
            Post settings
          </Button>
          <Button size="sm" loading={save.isPending} disabled={!canSave} onClick={onSave}>
            {isEdit ? 'Save' : 'Publish'}
          </Button>
        </div>
      </header>

      <div className="editor-screen__body">
        <div className="editor-doc">
          <input
            className="editor__title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Title"
          />
          <MarkdownEditor
            key={rkey ?? 'new'}
            defaultValue={documentMarkdown(existing.doc)}
            getMarkdownRef={getMarkdown}
          />
          {save.isError && (
            <p className="editor__error">{save.error instanceof Error ? save.error.message : 'Failed to save'}</p>
          )}
        </div>

        {panelOpen && (
          <aside className="editor-panel">
            <h2 className="editor-panel__title">Post settings</h2>

            <div className="studio-field">
              <span className="studio-field__label">Cover image</span>
              {coverPreview ? (
                <div className="editor-cover">
                  <Img src={coverPreview} alt="" />
                </div>
              ) : (
                <div className="editor-cover editor-cover--empty">No cover</div>
              )}
              <div className="editor-cover__actions">
                <label className="btn btn--secondary btn--sm">
                  {coverPreview ? 'Replace' : 'Add cover'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      setCoverFile(e.target.files?.[0] ?? null)
                      setCoverRemoved(false)
                    }}
                  />
                </label>
                {coverPreview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCoverFile(null)
                      setCoverRemoved(true)
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <label className="studio-field">
              <span className="studio-field__label">URL slug</span>
              <div className="editor-panel__slug">
                <span>{subdomain}.ovoid.at/</span>
                <input
                  className="studio-input"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(slugify(e.target.value))
                  }}
                  placeholder="slug"
                />
              </div>
            </label>
            <label className="studio-field">
              <span className="studio-field__label">Excerpt</span>
              <textarea
                className="studio-input studio-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Short summary shown in previews"
              />
            </label>
            <label className="studio-field">
              <span className="studio-field__label">Tags</span>
              <input
                className="studio-input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma, separated"
              />
            </label>
          </aside>
        )}
      </div>
    </div>
  )
}
