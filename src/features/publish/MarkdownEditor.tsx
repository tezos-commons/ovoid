import { useEffect, useRef, type MutableRefObject } from 'react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './editor.css'

/**
 * WYSIWYG markdown editor (Milkdown Crepe). The body source of truth is markdown
 * — we store it as `at.markpub.markdown`. `getMarkdownRef.current` is wired to
 * the live editor so the parent can read the current markdown on save.
 *
 * `defaultValue` seeds the editor once on mount; later prop changes don't reset
 * it (the editor owns its state thereafter), so editors are mounted per document
 * via a React `key`.
 */
export function MarkdownEditor({
  defaultValue,
  getMarkdownRef,
}: {
  defaultValue: string
  getMarkdownRef: MutableRefObject<(() => string) | null>
}) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = host.current
    if (!root) return
    const crepe = new Crepe({ root, defaultValue })
    let destroyed = false
    void crepe.create().then(() => {
      if (!destroyed) getMarkdownRef.current = () => crepe.getMarkdown()
    })
    return () => {
      destroyed = true
      getMarkdownRef.current = null
      void crepe.destroy()
    }
    // Mount-once; remount via key when switching documents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="md-editor" ref={host} />
}
