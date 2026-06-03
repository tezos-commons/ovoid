import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Button, Dialog, Spinner, ErrorState } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useProfile } from './use-profile'
import { useEditProfile } from './use-edit-profile'
import './profile.css'

const MAX_NAME = 64
const MAX_DESC = 256 // app.bsky.actor.profile description maxGraphemes

/**
 * Edit-own-profile route (/profile/:actor/edit). Rendered as a Dialog layered
 * over the profile; closing navigates back. Self-only: if the route actor isn't
 * the viewer, redirect to the read-only profile (the router already gates this
 * behind RequireAuth, so `did` is defined here).
 *
 * Image fields preview via object URLs (revoked on unmount). The actual blob
 * upload + putRecord read-modify-write happens in useEditProfile so existing
 * avatar/banner are preserved when untouched.
 */
export default function EditProfileModal() {
  const { actor } = useParams<{ actor: string }>()
  const navigate = useNavigate()
  const { did } = useAgent()
  const profileQ = useProfile(actor)
  const edit = useEditProfile()

  const profile = profileQ.data
  const close = () => navigate(`/profile/${actor}`, { replace: true })

  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const seeded = useRef(false)

  // Seed form state once the profile loads (guarded so user edits aren't clobbered).
  useEffect(() => {
    if (profile && !seeded.current) {
      seeded.current = true
      setDisplayName(profile.displayName ?? '')
      setDescription(profile.description ?? '')
    }
  }, [profile])

  // Revoke object URLs when previews change / on unmount to avoid leaks.
  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    if (bannerPreview) URL.revokeObjectURL(bannerPreview)
  }, [avatarPreview, bannerPreview])

  // Self-guard: only the owner may edit. profile.did is the canonical identity.
  if (profile && profile.did !== did) {
    return <Navigate to={`/profile/${actor}`} replace />
  }

  const pickAvatar = (file: File) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }
  const pickBanner = (file: File) => {
    if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  const onSave = () => {
    edit.mutate(
      { displayName, description, avatarFile, bannerFile },
      { onSuccess: close },
    )
  }

  const descOver = [...description].length > MAX_DESC

  return (
    <Dialog open onClose={close} title="Edit profile">
      {profileQ.isLoading && (
        <div className="proffeed__center">
          <Spinner />
        </div>
      )}
      {profileQ.isError && (
        <ErrorState error={profileQ.error} onRetry={() => profileQ.refetch()} />
      )}

      {profile && (
        <div className="editprofile">
          {/* Banner picker */}
          <label className="editprofile__banner">
            {(bannerPreview || profile.banner) && (
              <img src={bannerPreview ?? profile.banner} alt="" />
            )}
            <span className="editprofile__banner-cta">Change banner</span>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && pickBanner(e.target.files[0])}
            />
          </label>

          {/* Avatar picker overlapping the banner */}
          <label className="editprofile__avatar">
            <Avatar
              src={avatarPreview ?? profile.avatar}
              alt={profile.displayName || profile.handle}
              size="xl"
            />
            <span className="editprofile__avatar-cta">Change</span>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && pickAvatar(e.target.files[0])}
            />
          </label>

          <div className="editprofile__field">
            <label htmlFor="ep-name">Display name</label>
            <input
              id="ep-name"
              className="editprofile__input"
              value={displayName}
              maxLength={MAX_NAME}
              placeholder="Display name"
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="editprofile__field">
            <label htmlFor="ep-desc">Description</label>
            <textarea
              id="ep-desc"
              className="editprofile__textarea"
              value={description}
              rows={4}
              placeholder="Tell the world about yourself"
              onChange={(e) => setDescription(e.target.value)}
            />
            <span
              className="editprofile__counter"
              style={descOver ? { color: 'var(--color-danger)' } : undefined}
            >
              {[...description].length}/{MAX_DESC}
            </span>
          </div>

          {edit.isError && <ErrorState error={edit.error} title="Couldn't save profile" />}

          <div className="editprofile__actions">
            <Button variant="ghost" onClick={close} disabled={edit.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={edit.isPending}
              disabled={descOver}
              onClick={onSave}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
