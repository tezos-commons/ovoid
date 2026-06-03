import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Section, Row, Segment } from './components'
import {
  useTheme,
  useAppearanceStore,
  type Theme,
  type FontScale,
  type FontFamily,
} from './theme-store'

/** Swatch dot tinted by a theme's base background, for the theme picker labels. */
function Swatch({ bg }: { bg: string }) {
  return <span className="theme-swatch" style={{ background: bg }} />
}

const THEME_OPTIONS: { value: Theme; label: React.ReactNode }[] = [
  { value: 'dark', label: <><Swatch bg="#030206" /> Dark</> },
  { value: 'dim', label: <><Swatch bg="#1e1730" /> Dim</> },
  { value: 'light', label: <><Swatch bg="#ffffff" /> Light</> },
]

const SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'default', label: 'M' },
  { value: 'large', label: 'L' },
  { value: 'larger', label: 'XL' },
]

const FAMILY_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'inter', label: 'Inter' },
  { value: 'system', label: 'System' },
]

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const fontScale = useAppearanceStore((s) => s.fontScale)
  const fontFamily = useAppearanceStore((s) => s.fontFamily)
  const setFontScale = useAppearanceStore((s) => s.setFontScale)
  const setFontFamily = useAppearanceStore((s) => s.setFontFamily)

  return (
    <>
      <ScreenHeader title="Appearance" showBack />
      <div className="settings">
        <Section title="Theme" desc="Choose a colour mode. The selection is saved on this device.">
          <Row
            label="Colour mode"
            trailing={
              <Segment
                ariaLabel="Colour theme"
                value={theme}
                options={THEME_OPTIONS}
                onChange={setTheme}
              />
            }
          />
        </Section>

        <Section title="Text" desc="Font size and typeface used throughout the app.">
          <Row
            label="Font size"
            trailing={
              <Segment
                ariaLabel="Font size"
                value={fontScale}
                options={SCALE_OPTIONS}
                onChange={setFontScale}
              />
            }
          />
          <Row
            label="Typeface"
            sub="System uses your device's default UI font."
            trailing={
              <Segment
                ariaLabel="Typeface"
                value={fontFamily}
                options={FAMILY_OPTIONS}
                onChange={setFontFamily}
              />
            }
          />
        </Section>
      </div>
    </>
  )
}
