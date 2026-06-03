import { Routes, Route, Navigate } from 'react-router-dom'
import { PageAside } from '@/components/layout'
import './settings.css'

import SettingsHome from './SettingsHome'
import { SettingsNav } from './SettingsNav'
import AccountSettings from './AccountSettings'
import AppearanceSettings from './AppearanceSettings'
import ModerationSettings from './ModerationSettings'
import ModerationListScreen from './ModerationListScreen'
import AppPasswordsSettings from './AppPasswordsSettings'
import {
  PrivacySettings,
  AccessibilitySettings,
  LanguageSettings,
  AboutSettings,
} from './SimpleScreens'

/**
 * Settings tree. Mounted by the top-level router at `settings/*`, so the routes
 * here are relative to `/settings`. Each leaf renders its own ScreenHeader (with
 * a back button) so the 52px sticky header stays consistent with other screens.
 *
 * The whole subtree is auth-protected by the router's protectedEl wrapper.
 */
export default function SettingsScreen() {
  return (
    <>
      <PageAside>
        <SettingsNav />
      </PageAside>
      <Routes>
      <Route index element={<SettingsHome />} />
      <Route path="account" element={<AccountSettings />} />
      <Route path="privacy" element={<PrivacySettings />} />
      <Route path="moderation" element={<ModerationSettings />} />
      <Route path="moderation/muted" element={<ModerationListScreen kind="muted" />} />
      <Route path="moderation/blocked" element={<ModerationListScreen kind="blocked" />} />
      <Route path="appearance" element={<AppearanceSettings />} />
      <Route path="accessibility" element={<AccessibilitySettings />} />
      <Route path="languages" element={<LanguageSettings />} />
      <Route path="app-passwords" element={<AppPasswordsSettings />} />
      <Route path="about" element={<AboutSettings />} />
      {/* Unknown sub-path → settings root */}
      <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </>
  )
}
