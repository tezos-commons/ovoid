import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Avatar, Spinner, Button } from '@/components'
import { useAuth } from '@/lib/api/agent'
import { Section, Row } from './components'
import { useAccount, useSessionInfo } from './use-account'

export default function AccountSettings() {
  const { signOut } = useAuth()
  const { data: profile, isLoading } = useAccount()
  const session = useSessionInfo()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <ScreenHeader title="Account" showBack />
      <div className="settings">
        <div className="settings-account">
          {isLoading ? (
            <Spinner />
          ) : (
            <>
              <Avatar
                src={profile?.avatar}
                size="lg"
                fallback={(profile?.handle ?? '?').charAt(0).toUpperCase()}
              />
              <span className="settings-account__meta">
                <strong>{profile?.displayName || profile?.handle}</strong>
                <span className="settings-row__sub">@{profile?.handle}</span>
              </span>
            </>
          )}
        </div>

        <Section title="Identity">
          <div className="settings-pad">
            <div className="settings-kv">
              <span className="settings-kv__k">Handle</span>
              <span className="settings-kv__v">{profile?.handle ?? '—'}</span>
              <span className="settings-kv__k">DID</span>
              <span className="settings-kv__v">{session.did ?? '—'}</span>
            </div>
          </div>
          <Row
            label="Edit profile"
            sub="Display name, bio, avatar & banner"
            to={profile ? `/profile/${profile.handle}/edit` : undefined}
          />
        </Section>

        <Section
          title="Account management"
          desc="Email, password, and handle changes are managed on your hosting provider (PDS)."
        >
          <Row label="Change handle" sub="Managed on your PDS" />
          <Row label="Export my data" sub="Download your repository (CAR)" />
        </Section>

        <Section>
          <div className="settings-pad">
            <Button variant="danger" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </Section>
      </div>
    </>
  )
}
