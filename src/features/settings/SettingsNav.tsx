import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components'
import {
  PersonIcon,
  GearIcon,
  BellIcon,
  HashIcon,
  ListIcon,
  WalletIcon,
} from '@/components/Icon'
import { useAuth } from '@/lib/api/agent'
import { reloadApp } from '@/lib/reload-app'
import { Section, Row } from './components'
import { useAccount } from './use-account'

/** Lock-shaped privacy glyph reusing the shared stroke conventions. */
function ShieldIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    </svg>
  )
}
function GlobeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
    </svg>
  )
}
function KeyIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 20 3M16 6l3 3M14 8l2 2" />
    </svg>
  )
}
function AccessibilityIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="5" r="2" />
      <path d="M5 9l5 1v4l-2 6M19 9l-5 1v4l2 6M10 10h4" />
    </svg>
  )
}
function InfoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}
function SignOutIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}
function ReloadIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

/**
 * Settings section menu — the persistent left column for the whole /settings
 * subtree (the master in a master/detail layout). Each detail pane renders in
 * the page's main column. On mobile the page aside stacks above the detail.
 */
export function SettingsNav() {
  const { signOut, handle } = useAuth()
  const { data: profile } = useAccount()
  const navigate = useNavigate()

  const displayHandle = profile?.handle ?? handle ?? ''

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="settings settings-nav">
      <Section>
        <Row
          to="/settings/account"
          icon={
            <Avatar
              src={profile?.avatar}
              size="sm"
              fallback={(displayHandle || '?').charAt(0).toUpperCase()}
            />
          }
          label={profile?.displayName || displayHandle || 'Account'}
          sub={displayHandle ? `@${displayHandle}` : undefined}
        />
      </Section>

      <Section title="Settings">
        <Row to="/settings/account" icon={<PersonIcon />} label="Account" sub="Handle, DID, data export" />
        <Row to="/settings/privacy" icon={<ShieldIcon />} label="Privacy & Security" />
        <Row to="/settings/notifications" icon={<BellIcon />} label="Notifications" sub="Push notifications & per-type settings" />
        <Row to="/settings/moderation" icon={<GearIcon />} label="Moderation" sub="Muted words, content filters" />
        <Row to="/settings/appearance" icon={<HashIcon />} label="Appearance" sub="Theme & font" />
        <Row to="/settings/accessibility" icon={<AccessibilityIcon />} label="Accessibility" />
        <Row to="/settings/languages" icon={<GlobeIcon />} label="Languages" />
      </Section>

      <Section title="Advanced">
        <Row to="/settings/wallet" icon={<WalletIcon />} label="Linked Wallet" sub="Tezos address shown on your profile" />
        <Row to="/settings/app-passwords" icon={<KeyIcon />} label="App Passwords" sub="Session & legacy access" />
        <Row to="/settings/lists" icon={<ListIcon />} label="Threads & feed preferences" />
        <Row to="/settings/about" icon={<InfoIcon />} label="About" />
      </Section>

      <Section>
        <Row
          danger
          icon={<SignOutIcon />}
          label="Sign out"
          sub={displayHandle ? `@${displayHandle}` : undefined}
          onClick={handleSignOut}
        />
      </Section>

      <Section>
        <Row
          icon={<ReloadIcon />}
          label="Reload app"
          sub="Clear caches & fetch the latest version"
          onClick={() => void reloadApp()}
        />
      </Section>
    </div>
  )
}
