import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

export interface MessageMenuProps {
  /** Side the bubble is on, so the desktop menu aligns to the same edge. */
  align: 'start' | 'end'
  /** Mobile renders a fixed bottom sheet (portaled); desktop an anchored popover. */
  mobile: boolean
  onReply: () => void
  onCopy: () => void
  onClose: () => void
}

/**
 * Per-message context menu (group chats) with Reply / Copy text, opened on
 * long-press (mobile) / right-click (desktop).
 *
 * Desktop: an absolutely-anchored popover above the bubble (rendered in the
 * bubble wrap). Mobile: a fixed bottom sheet portaled to <body> — the chat
 * scroll container clips overflow, so an in-tree absolute popover gets cut off
 * or mispositioned on a phone; portaling + position:fixed sidesteps that.
 */
export function MessageMenu({ align, mobile, onReply, onCopy, onClose }: MessageMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Defer so the opening press doesn't immediately close it.
    const id = setTimeout(() => {
      document.addEventListener('pointerdown', onDown)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const menu = (
    <div
      ref={ref}
      className={clsx('msg-menu', mobile ? 'msg-menu--sheet' : `msg-menu--${align}`)}
      role="menu"
    >
      <button type="button" className="msg-menu__item" role="menuitem" onClick={onReply}>
        <ReplyIcon />
        Reply
      </button>
      <button type="button" className="msg-menu__item" role="menuitem" onClick={onCopy}>
        <CopyIcon />
        Copy text
      </button>
    </div>
  )

  if (!mobile) return menu

  // Bottom sheet: portal past the clipping scroll container, dim the rest.
  return createPortal(
    <>
      <div className="msg-menu__backdrop" />
      {menu}
    </>,
    document.body,
  )
}

function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 17l-5-5 5-5" />
      <path d="M4 12h11a5 5 0 0 1 5 5v1" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}
