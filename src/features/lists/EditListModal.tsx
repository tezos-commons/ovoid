import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppBskyGraphDefs, BlobRef } from '@atproto/api'
import { Avatar, Button, Dialog } from '@/components'
import { uploadImage } from '@/lib/blob'
import { useAgent } from '@/lib/api/agent'
import { CURATE, MODLIST } from './use-list'
import { useCreateList, useEditList } from './use-list-membership'
import { listPermalink } from './list-uri'

interface EditListModalProps {
  open: boolean
  onClose: () => void
  /** Present => edit mode; absent => create mode. */
  list?: AppBskyGraphDefs.ListView
}

/**
 * Create or edit a list. On create we navigate to the new list's detail page.
 * On edit we re-send every field (putRecord replaces the whole record) and pass
 * the previous avatar BlobRef through so it isn't wiped when unchanged.
 */
export function EditListModal({ open, onClose, list }: EditListModalProps) {
  const navigate = useNavigate()
  const { agent } = useAgent()
  const isEdit = !!list

  const [purpose, setPurpose] = useState<string>(list?.purpose ?? CURATE)
  const [name, setName] = useState(list?.name ?? '')
  const [description, setDescription] = useState(list?.description ?? '')
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(list?.avatar)
  const [avatarBlob, setAvatarBlob] = useState<BlobRef | undefined>()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const create = useCreateList()
  const edit = useEditList()
  const pending = create.isPending || edit.isPending || uploading

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const blob = await uploadImage(agent, file)
      setAvatarBlob(blob)
      setAvatarPreview(URL.createObjectURL(file))
    } catch (err) {
      setError('Failed to upload image.')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('A list name is required.')
      return
    }
    setError(null)
    try {
      if (isEdit) {
        // NOTE: ListView.avatar is a CDN URL, not the original BlobRef, so we
        // cannot re-attach an unchanged avatar from the view alone. To preserve
        // it on edit we re-read the raw record below and merge its avatar.
        let keepAvatar: BlobRef | undefined
        if (!avatarBlob) {
          try {
            const rkey = list!.uri.split('/').pop() ?? ''
            const rec = await agent.com.atproto.repo.getRecord({
              repo: list!.creator.did,
              collection: 'app.bsky.graph.list',
              rkey,
            })
            keepAvatar = (rec.data.value as { avatar?: BlobRef }).avatar
          } catch {
            keepAvatar = undefined
          }
        }
        await edit.mutateAsync({
          listUri: list!.uri,
          purpose, // purpose is not editable on bsky, but re-sent unchanged
          name: name.trim(),
          description: description.trim(),
          avatar: avatarBlob,
          keepAvatar,
        })
        onClose()
      } else {
        const res = await create.mutateAsync({
          purpose,
          name: name.trim(),
          description: description.trim(),
          avatar: avatarBlob,
        })
        onClose()
        navigate(listPermalink(res.uri))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? 'Edit list' : 'New list'}>
      <div className="list-form">
        <div
          className="list-form__field"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <Avatar src={avatarPreview} alt={name} size="lg" shape="rounded-square" fallback={name || 'L'} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
          <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            {avatarPreview ? 'Change avatar' : 'Add avatar'}
          </Button>
        </div>

        {!isEdit && (
          <div className="list-form__field">
            <span className="list-form__label">Purpose</span>
            <div className="list-form__purpose">
              <button
                type="button"
                className={`list-form__purpose-opt${purpose === CURATE ? ' list-form__purpose-opt--active' : ''}`}
                onClick={() => setPurpose(CURATE)}
              >
                <strong>User list</strong>
                <span>Curate posts; feed of members.</span>
              </button>
              <button
                type="button"
                className={`list-form__purpose-opt${purpose === MODLIST ? ' list-form__purpose-opt--active' : ''}`}
                onClick={() => setPurpose(MODLIST)}
              >
                <strong>Moderation</strong>
                <span>Mute or block everyone on it.</span>
              </button>
            </div>
          </div>
        )}

        <div className="list-form__field">
          <span className="list-form__label">Name</span>
          <input
            className="list-form__input"
            value={name}
            maxLength={64}
            placeholder="e.g. Cool people"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="list-form__field">
          <span className="list-form__label">Description</span>
          <textarea
            className="list-form__textarea"
            value={description}
            maxLength={300}
            placeholder="What's this list about?"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && <div className="list-form__error">{error}</div>}

        <div className="list-form__actions">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending}>
            {isEdit ? 'Save' : 'Create list'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
