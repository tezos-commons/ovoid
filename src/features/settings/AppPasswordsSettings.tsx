import { useState, type FormEvent } from 'react'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Button, Spinner, EmptyState } from '@/components'
import { Section, Row, Switch } from './components'
import { useSessionInfo } from './use-account'
import {
  useAppPasswords,
  useCreateAppPassword,
  useRevokeAppPassword,
  type CreatedAppPassword,
} from './use-app-passwords'
import { normalizeXrpcError } from '@/lib/api/errors'

export default function AppPasswordsSettings() {
  const session = useSessionInfo()
  const list = useAppPasswords()
  const create = useCreateAppPassword()
  const revoke = useRevokeAppPassword()

  const [name, setName] = useState('')
  const [privileged, setPrivileged] = useState(false)
  const [created, setCreated] = useState<CreatedAppPassword | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), privileged },
      {
        onSuccess: (res) => {
          setCreated(res)
          setName('')
          setPrivileged(false)
        },
      },
    )
  }

  return (
    <>
      <ScreenHeader title="App Passwords" showBack />
      <div className="settings">
        <Section
          title="Current session"
          desc="This client signs in with atproto OAuth; tokens are DPoP-bound and refreshed automatically."
        >
          <div className="settings-pad">
            <div className="settings-kv">
              <span className="settings-kv__k">Method</span>
              <span className="settings-kv__v">OAuth (DPoP)</span>
              <span className="settings-kv__k">Account DID</span>
              <span className="settings-kv__v">{session.did ?? '—'}</span>
              <span className="settings-kv__k">Token storage</span>
              <span className="settings-kv__v">{session.storage}</span>
            </div>
          </div>
        </Section>

        <Section
          title="App passwords"
          desc="Create scoped passwords for legacy apps and third-party tools that don't support OAuth. The full password is shown once."
        >
          <div className="settings-pad">
            {created && (
              <div className="settings-chip" style={{ alignSelf: 'stretch', justifyContent: 'space-between' }}>
                <span>
                  <strong>{created.name}</strong>
                  <code style={{ marginLeft: 8 }}>{created.password}</code>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigator.clipboard?.writeText(created.password)}
                >
                  Copy
                </Button>
              </div>
            )}

            <form className="settings-inline-form" onSubmit={submit}>
              <input
                className="settings-input"
                placeholder="Name (e.g. my-bot)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="App password name"
              />
              <Button type="submit" size="sm" loading={create.isPending} disabled={!name.trim()}>
                Create
              </Button>
            </form>

            <Row
              label="Allow direct messages"
              sub="Privileged passwords can access chat (DMs)."
              trailing={
                <Switch
                  label="Privileged app password"
                  checked={privileged}
                  onChange={setPrivileged}
                />
              }
            />

            {create.error != null && (
              <p className="settings-note" style={{ color: 'var(--color-danger)' }}>
                {normalizeXrpcError(create.error).message}
              </p>
            )}
          </div>
        </Section>

        <Section title="Existing app passwords">
          {list.isLoading && (
            <div style={{ padding: 'var(--space-5)', display: 'flex', justifyContent: 'center' }}>
              <Spinner />
            </div>
          )}

          {list.error != null && (
            <p className="settings-note">
              Couldn't load app passwords:{' '}
              <strong>{normalizeXrpcError(list.error).message}</strong>. Some providers restrict
              app-password management to password-based sessions, so this may be unavailable while
              signed in with OAuth.
            </p>
          )}

          {!list.isLoading && !list.error && (list.data?.length ?? 0) === 0 && (
            <EmptyState title="No app passwords" message="You haven't created any app passwords yet." />
          )}

          {list.data?.map((p) => (
            <Row
              key={p.name}
              label={p.name}
              sub={`Created ${new Date(p.createdAt).toLocaleDateString()}${p.privileged ? ' · DM access' : ''}`}
              trailing={
                <Button
                  variant="danger"
                  size="sm"
                  loading={revoke.isPending && revoke.variables === p.name}
                  onClick={() => revoke.mutate(p.name)}
                >
                  Revoke
                </Button>
              }
            />
          ))}
        </Section>
      </div>
    </>
  )
}
