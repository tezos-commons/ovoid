import { Dialog } from '@/components'
import { useComposerStore } from '@/store/compose-store'
import { useCloseOnBack } from '@/lib/use-close-on-back'
import { Composer } from './Composer'

/**
 * Home-scoped compose modal. Driven by the composer store (open via the
 * composer row, the reply action, or a quote). Self-contained so the home
 * feature works without the (not-yet-built) global compose feature.
 */
export function ComposeModal() {
  const open = useComposerStore((s) => s.open)
  const target = useComposerStore((s) => s.target)
  const close = useComposerStore((s) => s.close)

  // Back button / back-swipe closes the composer instead of navigating away.
  useCloseOnBack(open, close)

  return (
    <Dialog
      open={open}
      onClose={close}
      title={target.replyTo ? 'Reply' : target.quote ? 'Quote post' : 'New post'}
    >
      {open && <Composer target={target} onPosted={close} />}
    </Dialog>
  )
}
