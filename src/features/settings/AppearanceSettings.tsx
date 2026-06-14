import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { useIsMobile } from '@/lib/use-is-mobile'
import { Section, Row, Segment } from './components'
import {
  useTheme,
  useAppearanceStore,
  type Theme,
  type FontScale,
  type FontFamily,
  type GlassOpacity,
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

const GLASS_OPTIONS: { value: GlassOpacity; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'default', label: 'Default' },
  { value: 'frosted', label: 'Frosted' },
  { value: 'solid', label: 'Solid' },
]

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()
  const fontScale = useAppearanceStore((s) => s.fontScale)
  const fontFamily = useAppearanceStore((s) => s.fontFamily)
  const glassOpacity = useAppearanceStore((s) => s.glassOpacity)
  const setFontScale = useAppearanceStore((s) => s.setFontScale)
  const setFontFamily = useAppearanceStore((s) => s.setFontFamily)
  const setGlassOpacity = useAppearanceStore((s) => s.setGlassOpacity)

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

        {/* The liquid-glass bars only exist in the mobile chrome, so this knob is
            irrelevant on desktop — show it only at phone widths. useIsMobile is
            reactive, so it appears/disappears live when crossing the breakpoint. */}
        {isMobile && (
          <Section
            title="Glass opacity"
            desc="Translucency of the floating navigation bars. Lower is glassier; higher is more solid."
          >
            <div className="settings-stack-control">
              <Segment
                full
                ariaLabel="Glass opacity"
                value={glassOpacity}
                options={GLASS_OPTIONS}
                onChange={setGlassOpacity}
              />
            </div>
          </Section>
        )}
      </div>
    </>
  )
}
