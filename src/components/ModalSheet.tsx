import clsx from 'clsx'
import { Dialog, type DialogProps } from './Dialog'

/**
 * Modal on desktop, content-height bottom sheet on mobile — Dialog's scrim,
 * focus trap and scroll lock with the fit-sheet presentation (rounded top,
 * grab handle, slides up, sized by its content instead of full-screen).
 *
 * Use for compact info/confirm surfaces. Full-height flows (composer, follow
 * lists) keep using Dialog directly, whose mobile sheet fills the screen.
 */
export function ModalSheet({ className, ...rest }: DialogProps) {
  return <Dialog {...rest} sheetOnMobile className={clsx('dialog--fit', className)} />
}
