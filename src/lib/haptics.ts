/**
 * Tactile confirmation for touch actions via the Vibration API. A no-op wherever
 * the API is absent or disabled (iOS Safari, desktop, reduced-interaction privacy
 * settings) — callers never need to feature-check.
 *
 * Patterns are deliberately tiny: an action should feel like a tick, not a buzz.
 * `light` for routine taps (like, repost), `medium` for committal gestures
 * (swipe-back, long-press menu), `success` for completed sends.
 */
type HapticKind = 'light' | 'medium' | 'success'

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 15,
  success: [10, 40, 12],
}

export function haptic(kind: HapticKind = 'light'): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(PATTERNS[kind])
  }
}
