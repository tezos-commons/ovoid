import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { EmptyState } from '@/components'

/**
 * Settings index pane. The section menu now lives in the page aside
 * (SettingsNav), persistent across every /settings route, so the index just
 * prompts the user to pick a section. On mobile the aside menu stacks above
 * this pane, so it reads as the settings home.
 */
export default function SettingsHome() {
  return (
    <>
      <ScreenHeader title="Settings" showBack />
      <div className="settings">
        <EmptyState title="Settings" message="Choose a section from the menu." />
      </div>
    </>
  )
}
