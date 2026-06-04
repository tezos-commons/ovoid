import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AppBskyLabelerDefs } from '@atproto/api'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Button, SettingsSkeleton, ErrorState } from '@/components'
import { CloseIcon } from '@/components/Icon'
import { useLabelerSubscription } from '@/features/profile/use-labeler'
import { Section, Row, Switch } from './components'
import {
  usePreferences,
  useMutedWordsMutation,
  useAdultContentMutation,
  useLabelerProfiles,
  selectMutedWords,
  selectAdultContentEnabled,
  selectLabelers,
} from './use-preferences'

export default function ModerationSettings() {
  const { data: prefs, isLoading, error, refetch } = usePreferences()
  const mutedWords = useMutedWordsMutation()
  const adultContent = useAdultContentMutation()
  const [draft, setDraft] = useState('')

  const words = selectMutedWords(prefs)
  const adultEnabled = selectAdultContentEnabled(prefs)
  const labelers = selectLabelers(prefs)
  const labelerProfiles = useLabelerProfiles(labelers.map((l) => l.did))

  function addWord(e: FormEvent) {
    e.preventDefault()
    const value = draft.trim()
    if (!value) return
    mutedWords.mutate({ action: 'add', value })
    setDraft('')
  }

  return (
    <>
      <ScreenHeader title="Moderation" showBack />
      <div className="settings">
        {isLoading && <SettingsSkeleton sections={3} />}
        {error && <ErrorState error={error} onRetry={() => refetch()} />}

        {!isLoading && !error && (
          <>
            <Section
              title="Content filters"
              desc="Control which sensitive content is shown across your feeds."
            >
              <Row
                label="Adult content"
                sub="Allow content labelled as adult to render."
                trailing={
                  <Switch
                    label="Allow adult content"
                    checked={adultEnabled}
                    onChange={(next) => adultContent.mutate(next)}
                  />
                }
              />
            </Section>

            <Section
              title="Muted words & tags"
              desc="Posts containing these words or hashtags are hidden from your feeds."
            >
              <div className="settings-pad">
                <form className="settings-inline-form" onSubmit={addWord}>
                  <input
                    className="settings-input"
                    placeholder="Add a word or #tag…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Word to mute"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    loading={mutedWords.isPending}
                    disabled={!draft.trim()}
                  >
                    Mute
                  </Button>
                </form>

                {words.length === 0 ? (
                  <p className="settings-section__desc" style={{ padding: 0 }}>
                    No muted words yet.
                  </p>
                ) : (
                  <div className="settings-chips">
                    {words.map((w) => (
                      <span className="settings-chip" key={w.value}>
                        {w.value}
                        <button
                          type="button"
                          className="settings-chip__x"
                          aria-label={`Unmute ${w.value}`}
                          onClick={() => mutedWords.mutate({ action: 'remove', value: w.value })}
                        >
                          <CloseIcon size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <Section
              title="Subscribed labelers"
              desc="Moderation services applying labels to your view."
            >
              {labelers.length === 0 ? (
                <p className="settings-section__desc">
                  Only the default Bluesky moderation service is active.
                </p>
              ) : (
                labelers.map((l) => (
                  <LabelerRow key={l.did} did={l.did} view={labelerProfiles.data?.get(l.did)} />
                ))
              )}
            </Section>

            <Section title="People">
              <Row label="Muted accounts" sub="Manage accounts you've muted" to="/settings/moderation/muted" />
              <Row label="Blocked accounts" sub="Manage accounts you've blocked" to="/settings/moderation/blocked" />
            </Section>
          </>
        )}
      </div>
    </>
  )
}

/**
 * One subscribed-labeler row. Owns its own subscription hook (so the toggle can
 * live in a list) and links the name to the labeler's profile. Since these are
 * always subscribed here, the toggle acts as Unsubscribe.
 */
function LabelerRow({ did, view }: { did: string; view?: AppBskyLabelerDefs.LabelerView }) {
  const sub = useLabelerSubscription(did)
  const creator = view?.creator
  const name = creator?.displayName || creator?.handle || did
  return (
    <Row
      label={
        <Link className="settings-link" to={`/profile/${creator?.handle || did}`}>
          {name}
        </Link>
      }
      sub={creator ? `@${creator.handle}` : 'Labeler'}
      trailing={
        <Button
          variant="secondary"
          size="sm"
          loading={sub.toggle.isPending || sub.isLoading}
          onClick={() => sub.toggle.mutate()}
        >
          Unsubscribe
        </Button>
      }
    />
  )
}
