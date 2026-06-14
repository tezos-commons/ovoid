/**
 * Shared guards for global keyboard handlers. App-wide shortcuts (command
 * palette, feed j/k, go-to chords) must never fire while the user is typing or an
 * overlay owns the keyboard.
 */

/** True when focus is in a text field — a global single-key shortcut must defer. */
export function isTypingTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** True when a modal dialog or the lightbox is open (they own Escape/arrows). */
export function isOverlayOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"], .lightbox')
}
