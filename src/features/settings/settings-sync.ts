import type { Agent } from '@atproto/api'
import { getPrivate, putPrivate } from '@/lib/data/client'
import { useUiStore, type Theme } from '@/store/ui-store'
import {
  useAppearanceStore,
  type FontScale,
  type FontFamily,
  type GlassOpacity,
} from './theme-store'
import { useAccessibilityStore } from './accessibility-store'
import { useLanguageStore } from './language-store'
import {
  useReaderPrefs,
  READER_THEMES,
  READER_SIZES,
  type ReaderTheme,
  type ReaderFontSize,
  type ReaderFont,
} from '@/features/read/reader-prefs'

/**
 * Cross-device settings sync, backed by the data.ovoid.at private namespace.
 *
 * The four local settings stores (colour theme in ui-store; appearance, a11y,
 * language in their own stores) remain the live source of truth the UI reads and
 * writes; localStorage is their per-device cache. This module mirrors a snapshot
 * of all four into ONE private blob so the settings follow the account.
 *
 * Reconciliation is whole-snapshot last-write-wins, keyed by a client-clock
 * `updatedAt` (unix seconds) stored alongside the blob and in localStorage:
 *
 *   - remote absent           -> push the current local snapshot (first sync /
 *                                migrates an existing local-only config up).
 *   - remote.updatedAt >= local -> remote is authoritative; hydrate the stores.
 *   - remote.updatedAt <  local -> this device edited more recently; push.
 *
 * LWW is per-snapshot, not per-field: two devices editing different settings
 * within the same reconcile window resolve to the later writer wholesale. That
 * matches the service's own upsert (latest wins) and is acceptable for settings;
 * field-level merge would be the refinement if it ever matters.
 *
 * After reconcile, every store change is written through (debounced). Writes are
 * deduped by content so unrelated ui-store churn (the store holds more than the
 * theme) never triggers a network write.
 */

/** Private blob key holding the settings snapshot. */
export const SETTINGS_KEY = 'settings'
const SCHEMA_VERSION = 1
const DEBOUNCE_MS = 1200

// The settings stores and their localStorage cache are device-global, but the
// server blob is per-account. The LWW timestamp must therefore be scoped per
// DID: a never-synced account reads ts=0 and so always takes its remote as
// authoritative, instead of pushing whatever the previous account left on the
// device over the new account's blob.
const localTsKey = (did: string) => `ovoid:settings:updatedAt:${did}`

/** Settings-relevant slice of state; `updatedAt` is added only at write time. */
interface SettingsBody {
  v: number
  theme: Theme
  appearance: { fontScale: FontScale; fontFamily: FontFamily; glassOpacity: GlassOpacity }
  a11y: {
    requireAltText: boolean
    autoplay: boolean
    reduceMotion: boolean
    largeAltBadges: boolean
    loggedOutVisibility: boolean
  }
  language: { primary: string; content: string[] }
  /** Reader appearance — decoupled from the app theme (see reader-prefs). */
  reader: { theme: ReaderTheme; fontSize: ReaderFontSize; fontFamily: ReaderFont }
}

interface SettingsSnapshot extends SettingsBody {
  /** unix seconds, client clock at the moment of the write. */
  updatedAt: number
}

const nowSec = () => Math.floor(Date.now() / 1000)

function readLocalTs(did: string): number {
  if (typeof localStorage === 'undefined') return 0
  const v = Number(localStorage.getItem(localTsKey(did)))
  return Number.isFinite(v) ? v : 0
}

function writeLocalTs(did: string, ts: number) {
  try {
    localStorage.setItem(localTsKey(did), String(ts))
  } catch {
    /* storage unavailable */
  }
}

/** Read the current settings out of the four live stores. */
function gather(): SettingsBody {
  const ui = useUiStore.getState()
  const ap = useAppearanceStore.getState()
  const a = useAccessibilityStore.getState()
  const l = useLanguageStore.getState()
  const r = useReaderPrefs.getState()
  return {
    v: SCHEMA_VERSION,
    theme: ui.theme,
    appearance: { fontScale: ap.fontScale, fontFamily: ap.fontFamily, glassOpacity: ap.glassOpacity },
    a11y: {
      requireAltText: a.requireAltText,
      autoplay: a.autoplay,
      reduceMotion: a.reduceMotion,
      largeAltBadges: a.largeAltBadges,
      loggedOutVisibility: a.loggedOutVisibility,
    },
    language: { primary: l.primary, content: l.content },
    reader: { theme: r.theme, fontSize: r.fontSize, fontFamily: r.fontFamily },
  }
}

// Stable content fingerprint (excludes updatedAt). gather() builds keys in a
// fixed order, so JSON.stringify is a sound equality probe here. Seeded by
// reconcile, updated on every write — the write-through dedupe key.
let lastContentKey: string | null = null
const contentKey = (b: SettingsBody) => JSON.stringify(b)

// True while apply() drives the stores, so the store subscriptions don't treat
// a hydration as a user edit and bounce it back to the server.
let applying = false

/**
 * Hydrate the stores from a remote snapshot. Each field is applied through the
 * store's own setter (which persists to localStorage + applies any DOM effect),
 * and only when it actually differs, so unchanged fields cause no work. Missing
 * or malformed fields leave the current value intact (forward schema tolerance).
 */
function apply(s: SettingsSnapshot) {
  applying = true
  try {
    const ui = useUiStore.getState()
    if (isTheme(s.theme) && s.theme !== ui.theme) ui.setTheme(s.theme)

    const ap = useAppearanceStore.getState()
    const a0 = s.appearance
    if (a0) {
      if (a0.fontScale && a0.fontScale !== ap.fontScale) ap.setFontScale(a0.fontScale)
      if (a0.fontFamily && a0.fontFamily !== ap.fontFamily) ap.setFontFamily(a0.fontFamily)
      if (a0.glassOpacity && a0.glassOpacity !== ap.glassOpacity) ap.setGlassOpacity(a0.glassOpacity)
    }

    const a = useAccessibilityStore.getState()
    const ax = s.a11y
    if (ax) {
      if (typeof ax.requireAltText === 'boolean' && ax.requireAltText !== a.requireAltText)
        a.setRequireAltText(ax.requireAltText)
      if (typeof ax.autoplay === 'boolean' && ax.autoplay !== a.autoplay) a.setAutoplay(ax.autoplay)
      if (typeof ax.reduceMotion === 'boolean' && ax.reduceMotion !== a.reduceMotion)
        a.setReduceMotion(ax.reduceMotion)
      if (typeof ax.largeAltBadges === 'boolean' && ax.largeAltBadges !== a.largeAltBadges)
        a.setLargeAltBadges(ax.largeAltBadges)
      if (typeof ax.loggedOutVisibility === 'boolean' && ax.loggedOutVisibility !== a.loggedOutVisibility)
        a.setLoggedOutVisibility(ax.loggedOutVisibility)
    }

    const l = useLanguageStore.getState()
    const lx = s.language
    if (lx) {
      if (lx.primary && lx.primary !== l.primary) l.setPrimary(lx.primary)
      if (Array.isArray(lx.content) && JSON.stringify(lx.content) !== JSON.stringify(l.content))
        l.setContent(lx.content.filter((c): c is string => typeof c === 'string'))
    }

    const r = useReaderPrefs.getState()
    const rx = s.reader
    if (rx) {
      if (READER_THEMES.includes(rx.theme) && rx.theme !== r.theme) r.setTheme(rx.theme)
      if (READER_SIZES.includes(rx.fontSize) && rx.fontSize !== r.fontSize) r.setFontSize(rx.fontSize)
      if ((rx.fontFamily === 'sans' || rx.fontFamily === 'serif') && rx.fontFamily !== r.fontFamily)
        r.setFontFamily(rx.fontFamily)
    }
  } finally {
    applying = false
  }
}

const isTheme = (t: unknown): t is Theme => t === 'light' || t === 'dim' || t === 'dark'

/** Push the current local snapshot to the server, unless byte-identical to the last write. */
async function pushSnapshot(agent: Agent, did: string): Promise<void> {
  const body = gather()
  const ck = contentKey(body)
  if (ck === lastContentKey) return
  const ts = nowSec()
  await putPrivate(agent, SETTINGS_KEY, { ...body, updatedAt: ts } satisfies SettingsSnapshot)
  writeLocalTs(did, ts)
  lastContentKey = ck
}

/**
 * One-shot reconcile against the server. Resolves the snapshot precedence and
 * leaves `lastContentKey` seeded so the subsequent write-through only fires on a
 * genuine post-reconcile change.
 */
export async function reconcileSettings(agent: Agent, did: string): Promise<void> {
  const remote = await getPrivate<SettingsSnapshot>(agent, SETTINGS_KEY)
  if (!remote || typeof remote.v !== 'number') {
    await pushSnapshot(agent, did)
    return
  }
  if ((remote.updatedAt ?? 0) >= readLocalTs(did)) {
    apply(remote)
    writeLocalTs(did, remote.updatedAt ?? nowSec())
    lastContentKey = contentKey(gather())
  } else {
    await pushSnapshot(agent, did)
  }
}

/**
 * Subscribe to all four stores and write changes through to the server,
 * debounced. Returns an unsubscribe.
 *
 * Subscriptions are unfiltered (zustand v5 selective subscribe needs middleware
 * not in use here), so the content-key check is what discards irrelevant
 * notifications — including ui-store changes unrelated to the theme.
 */
export function startWriteThrough(agent: Agent, did: string): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const onChange = () => {
    if (applying) return
    if (contentKey(gather()) === lastContentKey) return
    // Stamp the edit time immediately so LWW reflects when the user changed it,
    // even if the debounced push is delayed or fails.
    writeLocalTs(did, nowSec())
    clearTimeout(timer)
    timer = setTimeout(() => {
      void pushSnapshot(agent, did).catch(() => {
        /* will retry on the next edit */
      })
    }, DEBOUNCE_MS)
  }

  const unsubs = [
    useUiStore.subscribe(onChange),
    useAppearanceStore.subscribe(onChange),
    useAccessibilityStore.subscribe(onChange),
    useLanguageStore.subscribe(onChange),
    // settingsOpen toggles also notify, but contentKey (which excludes it)
    // discards those — only theme/size/font edits push.
    useReaderPrefs.subscribe(onChange),
  ]
  return () => {
    clearTimeout(timer)
    for (const u of unsubs) u()
  }
}
