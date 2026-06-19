import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { codeToHtml } from 'shiki'

/**
 * Syntax-highlighted code block via Shiki. Longer, language-tagged blocks get a
 * title bar (language label + copy button); short or untagged blocks stay bare
 * with a hover copy button floating top-right.
 *
 * Highlighting is async (Shiki lazy-loads the grammar per language), so we render
 * a plain <pre> immediately and swap in the highlighted markup once ready — no
 * layout shift, and a clean fallback for unknown languages. `defaultColor: false`
 * emits dual-theme CSS variables; reader.css picks the active <html data-theme>.
 */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    codeToHtml(code, {
      lang: language || 'text',
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    })
      .then((out) => alive && setHtml(out))
      .catch(() => alive && setHtml(null))
    return () => {
      alive = false
    }
  }, [code, language])

  const lines = code.split('\n').length
  const showBar = !!language && language !== 'text' && lines > 5

  const block = html ? (
    <div className="rdr-code rdr-code--shiki" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <pre className="rdr-code">
      <code>{code}</code>
    </pre>
  )

  return (
    <div className={clsx('rdr-code-wrap', showBar && 'rdr-code-wrap--barred')}>
      {showBar ? (
        <div className="rdr-code-bar">
          <span className="rdr-code-lang">{language}</span>
          <CopyButton code={code} inBar />
        </div>
      ) : (
        <CopyButton code={code} />
      )}
      {block}
    </div>
  )
}

function CopyButton({ code, inBar = false }: { code: string; inBar?: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable (insecure context / denied) — no-op */
    }
  }

  return (
    <button
      type="button"
      className={clsx('rdr-code-copy', inBar && 'rdr-code-copy--bar')}
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
