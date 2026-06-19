import type { ReactNode } from 'react'
import clsx from 'clsx'
import { ModalSheet } from '@/components'
import {
  useReaderPrefs,
  type ReaderTheme,
  type ReaderFontSize,
  type ReaderFont,
} from './reader-prefs'

interface Option<T extends string> {
  value: T
  node: ReactNode
  label: string
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div className="rdr-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={clsx('rdr-seg__btn', value === o.value && 'is-active')}
          aria-pressed={value === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => onChange(o.value)}
        >
          {o.node}
        </button>
      ))}
    </div>
  )
}

// A swatch reading the reader theme's own tokens (scoped via data-reader-theme).
function ThemeSwatch({ theme, label }: { theme: ReaderTheme; label: string }) {
  return (
    <span className="rdr-swatch" data-reader-theme={theme}>
      <span className="rdr-swatch__dot" />
      {label}
    </span>
  )
}

const THEMES: Option<ReaderTheme>[] = [
  { value: 'light', node: <ThemeSwatch theme="light" label="Light" />, label: 'Light' },
  { value: 'sepia', node: <ThemeSwatch theme="sepia" label="Sepia" />, label: 'Sepia' },
  { value: 'dim', node: <ThemeSwatch theme="dim" label="Dim" />, label: 'Dim' },
  { value: 'dark', node: <ThemeSwatch theme="dark" label="Dark" />, label: 'Dark' },
]

const SIZES: Option<ReaderFontSize>[] = [
  { value: 'small', node: <span style={{ fontSize: '0.8em' }}>A</span>, label: 'Small' },
  { value: 'default', node: <span style={{ fontSize: '1em' }}>A</span>, label: 'Default' },
  { value: 'large', node: <span style={{ fontSize: '1.2em' }}>A</span>, label: 'Large' },
  { value: 'larger', node: <span style={{ fontSize: '1.45em' }}>A</span>, label: 'Larger' },
]

const FONTS: Option<ReaderFont>[] = [
  { value: 'sans', node: <span style={{ fontFamily: 'var(--font-family)' }}>Sans</span>, label: 'Sans-serif' },
  { value: 'serif', node: <span style={{ fontFamily: 'Georgia, serif' }}>Serif</span>, label: 'Serif' },
]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rdr-set-field">
      <div className="rdr-set-field__label">{label}</div>
      {children}
    </div>
  )
}

/**
 * Kindle-style reading settings: reader theme (incl. sepia), text size and
 * typeface — all independent of the app's appearance. Triggered by the bottom-
 * left FAB (desktop) or the top-bar button (mobile); modal on desktop, sheet on
 * mobile.
 */
export function ReadingSettings() {
  const open = useReaderPrefs((s) => s.settingsOpen)
  const openSettings = useReaderPrefs((s) => s.openSettings)
  const closeSettings = useReaderPrefs((s) => s.closeSettings)

  const theme = useReaderPrefs((s) => s.theme)
  const setTheme = useReaderPrefs((s) => s.setTheme)
  const fontSize = useReaderPrefs((s) => s.fontSize)
  const setFontSize = useReaderPrefs((s) => s.setFontSize)
  const fontFamily = useReaderPrefs((s) => s.fontFamily)
  const setFontFamily = useReaderPrefs((s) => s.setFontFamily)

  return (
    <>
      <button
        type="button"
        className="rdr-settings-fab"
        aria-label="Reading settings"
        onClick={openSettings}
      >
        Aa
      </button>

      <ModalSheet open={open} onClose={closeSettings} title="Reading settings">
        <div className="rdr-settings">
          <Field label="Theme">
            <Segmented value={theme} options={THEMES} onChange={setTheme} ariaLabel="Reader theme" />
          </Field>
          <Field label="Text size">
            <Segmented value={fontSize} options={SIZES} onChange={setFontSize} ariaLabel="Text size" />
          </Field>
          <Field label="Typeface">
            <Segmented value={fontFamily} options={FONTS} onChange={setFontFamily} ariaLabel="Typeface" />
          </Field>
        </div>
      </ModalSheet>
    </>
  )
}
