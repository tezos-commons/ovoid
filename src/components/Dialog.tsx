import clsx from 'clsx'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './IconButton'
import { CloseIcon } from './Icon'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Render as a bottom sheet on mobile widths. */
  sheetOnMobile?: boolean
}

/**
 * Modal with scrim, Escape-to-close, scroll lock and a focus trap.
 * Rendered through a portal at document.body so it escapes the app-shell grid.
 */
export function Dialog({ open, onClose, title, children, sheetOnMobile = true }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab') trapFocus(e, panelRef.current)
    }
    document.addEventListener('keydown', onKey)

    // Move focus into the dialog.
    const toFocus = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    )
    toFocus?.focus()

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={clsx('dialog__scrim', sheetOnMobile && 'dialog__scrim--sheet')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={clsx('dialog', sheetOnMobile && 'dialog--sheet')}
        role="dialog"
        aria-modal="true"
      >
        {title !== undefined && (
          <div className="dialog__header">
            <span className="dialog__title">{title}</span>
            <IconButton label="Close" onClick={onClose}>
              <CloseIcon size={20} />
            </IconButton>
          </div>
        )}
        <div className="dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

function trapFocus(e: KeyboardEvent, container: HTMLElement | null) {
  if (!container) return
  const focusable = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}
