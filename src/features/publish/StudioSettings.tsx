import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Img, Spinner, Button } from '@/components'
import { blobUrl } from '@/lib/api/repo-read'
import { pubPath } from '@/features/read/use-publication'
import { usePublicationStudio } from './use-documents'
import { useUpdatePublication, useDeletePublication } from './use-publications'

/** Publication-details pane: edit name / description / icon, view, or delete. */
export default function StudioSettings() {
  const { subdomain } = useParams<{ subdomain: string }>()
  const navigate = useNavigate()
  const studio = usePublicationStudio(subdomain)
  const update = useUpdatePublication()
  const del = useDeletePublication()
  const rec = studio.record.data

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (seeded || !rec) return
    setName(rec.record.name ?? '')
    setDescription(rec.record.description ?? '')
    setSeeded(true)
  }, [seeded, rec])

  if (studio.record.isPending || !rec) {
    return <div className="studio-loading"><Spinner /></div>
  }

  const existingIcon = rec.record.icon ? blobUrl(rec.pds, rec.did, rec.record.icon.ref.$link) : undefined
  const previewIcon = iconFile ? URL.createObjectURL(iconFile) : existingIcon
  const href = pubPath(studio.pubUri ?? '')
  const canSave = name.trim().length > 0 && !update.isPending

  const save = () => {
    if (!canSave || !studio.pubUri) return
    update.mutate({
      uri: studio.pubUri,
      url: rec.record.url,
      name,
      description,
      iconFile,
      currentIcon: rec.record.icon,
    })
    setIconFile(null)
  }

  return (
    <div className="studio-pane studio-pane--narrow">
      <header className="studio-pane__head">
        <h1 className="studio-pane__title">Settings</h1>
        {href && (
          <Link to={href} className="btn btn--ghost btn--sm">View publication</Link>
        )}
      </header>

      <div className="studio-form">
        <div className="studio-field">
          <span className="studio-field__label">Icon</span>
          <div className="studio-icon-edit">
            <span className="studio-icon-edit__preview">
              {previewIcon ? <Img src={previewIcon} alt="" /> : <span className="studio-icon-edit__empty" />}
            </span>
            <label className="btn btn--secondary btn--sm">
              Change picture
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setIconFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>

        <label className="studio-field">
          <span className="studio-field__label">Name</span>
          <input className="studio-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={300} />
        </label>

        <label className="studio-field">
          <span className="studio-field__label">Description</span>
          <textarea
            className="studio-input studio-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={3000}
          />
        </label>

        <div className="studio-field">
          <span className="studio-field__label">Address</span>
          <p className="studio-field__static">
            {subdomain}.ovoid.at <span className="studio-field__hint">(can’t be changed)</span>
          </p>
        </div>

        {update.isError && (
          <p className="studio-error">{update.error instanceof Error ? update.error.message : 'Failed to save'}</p>
        )}

        <div className="studio-form__actions">
          <Button loading={update.isPending} disabled={!canSave} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>

      <div className="studio-danger">
        <div>
          <div className="studio-danger__title">Delete publication</div>
          <div className="studio-danger__desc">Frees the subdomain and removes the publication record. Posts are not deleted.</div>
        </div>
        <Button
          variant="danger"
          size="sm"
          loading={del.isPending}
          onClick={() => {
            if (studio.pubUri && confirm(`Delete “${rec.record.name}”? This frees ${subdomain}.ovoid.at.`)) {
              del.mutate(
                { subdomain: subdomain!, uri: studio.pubUri },
                { onSuccess: () => navigate('/') },
              )
            }
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
