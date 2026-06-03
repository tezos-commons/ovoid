import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Section, Row, Switch, Segment } from './components'
import { useAccessibilityStore } from './accessibility-store'
import { useLanguageStore, LANGUAGES } from './language-store'

/* ---------------- Privacy & Security ---------------- */

export function PrivacySettings() {
  const logged = useAccessibilityStore((s) => s.loggedOutVisibility)
  const setLogged = useAccessibilityStore((s) => s.setLoggedOutVisibility)
  return (
    <>
      <ScreenHeader title="Privacy & Security" showBack />
      <div className="settings">
        <Section title="Discoverability">
          <Row
            label="Logged-out visibility"
            sub="Allow signed-out users and search engines to see your profile and posts."
            trailing={
              <Switch label="Logged-out visibility" checked={logged} onChange={setLogged} />
            }
          />
        </Section>
        <Section
          title="Security"
          desc="This client uses atproto OAuth with DPoP-bound tokens stored in your browser. Two-factor and session revocation are managed on your hosting provider."
        >
          <Row label="App passwords" sub="Manage legacy & third-party access" to="/settings/app-passwords" />
        </Section>
      </div>
    </>
  )
}

/* ---------------- Accessibility ---------------- */

export function AccessibilitySettings() {
  const requireAlt = useAccessibilityStore((s) => s.requireAltText)
  const autoplay = useAccessibilityStore((s) => s.autoplay)
  const reduceMotion = useAccessibilityStore((s) => s.reduceMotion)
  const largeAltBadges = useAccessibilityStore((s) => s.largeAltBadges)
  const set = useAccessibilityStore

  return (
    <>
      <ScreenHeader title="Accessibility" showBack />
      <div className="settings">
        <Section title="Media">
          <Row
            label="Require alt text before posting"
            sub="Prompt when an image is missing a description."
            trailing={
              <Switch
                label="Require alt text"
                checked={requireAlt}
                onChange={set.getState().setRequireAltText}
              />
            }
          />
          <Row
            label="Autoplay videos & GIFs"
            trailing={
              <Switch label="Autoplay" checked={autoplay} onChange={set.getState().setAutoplay} />
            }
          />
          <Row
            label="Larger alt text badges"
            sub="Show ALT badges at a larger size on image embeds."
            trailing={
              <Switch
                label="Larger alt badges"
                checked={largeAltBadges}
                onChange={set.getState().setLargeAltBadges}
              />
            }
          />
        </Section>
        <Section title="Motion">
          <Row
            label="Reduce motion"
            sub="Minimise animations and transitions."
            trailing={
              <Switch
                label="Reduce motion"
                checked={reduceMotion}
                onChange={set.getState().setReduceMotion}
              />
            }
          />
        </Section>
      </div>
    </>
  )
}

/* ---------------- Languages ---------------- */

export function LanguageSettings() {
  const primary = useLanguageStore((s) => s.primary)
  const setPrimary = useLanguageStore((s) => s.setPrimary)
  const content = useLanguageStore((s) => s.content)
  const toggleContent = useLanguageStore((s) => s.toggleContent)

  return (
    <>
      <ScreenHeader title="Languages" showBack />
      <div className="settings">
        <Section
          title="App language"
          desc="The language used for the interface and as the default post language."
        >
          <div className="settings-pad">
            <Segment
              ariaLabel="App language"
              value={primary}
              onChange={setPrimary}
              options={LANGUAGES.slice(0, 4).map((l) => ({ value: l.code, label: l.label }))}
            />
          </div>
        </Section>
        <Section
          title="Content languages"
          desc="Show posts in these languages in your feeds. None selected shows everything."
        >
          {LANGUAGES.map((l) => (
            <Row
              key={l.code}
              label={l.label}
              trailing={
                <Switch
                  label={l.label}
                  checked={content.includes(l.code)}
                  onChange={() => toggleContent(l.code)}
                />
              }
            />
          ))}
        </Section>
      </div>
    </>
  )
}

/* ---------------- About ---------------- */

export function AboutSettings() {
  return (
    <>
      <ScreenHeader title="About" showBack />
      <div className="settings">
        <Section>
          <div className="settings-pad" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700 }}>Ovoid</h1>
            <p className="settings-note">
              A web client for Bluesky built on the AT Protocol.
            </p>
          </div>
        </Section>
        <Section title="Resources">
          <Row label="Bluesky" sub="bsky.app" to="/settings/about" />
          <Row label="AT Protocol" sub="atproto.com" to="/settings/about" />
          <Row label="Terms of Service" />
          <Row label="Privacy Policy" />
        </Section>
        <Section title="Build">
          <div className="settings-pad">
            <div className="settings-kv">
              <span className="settings-kv__k">Client</span>
              <span className="settings-kv__v">Ovoid web</span>
              <span className="settings-kv__k">Protocol</span>
              <span className="settings-kv__v">atproto / app.bsky.*</span>
            </div>
          </div>
        </Section>
      </div>
    </>
  )
}
