import { isValidElement, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Markdown, { type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Img } from '@/components'
import { useUiStore } from '@/store/ui-store'
import { bskyUrlToInternalPath } from '@/lib/bsky-links'
import { CodeBlock } from './CodeBlock'
import { ContentEmbeds } from './ContentEmbeds'
import { BskyPostEmbed } from './BskyPostEmbed'

/** Minimal hast shape for walking nodes for links / embed attributes. */
interface HastNode {
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/**
 * Allow raw HTML (markpub content embeds bsky-embed blockquotes, etc.) but
 * sanitize it — article content comes from arbitrary repos. We additionally
 * permit the `bluesky-embed` blockquote's class + data attributes so we can
 * detect and upgrade it to a native post embed.
 */
const sanitizeSchema = {
  ...defaultSchema,
  // Keep heading ids exactly as rehype-slug emits them (no clobber prefix) so the
  // DOM ids match the ToC's hrefs and our anchor links.
  clobberPrefix: '',
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id', 'className'],
    blockquote: [
      ...(defaultSchema.attributes?.blockquote ?? []),
      'className',
      'dataBlueskyUri',
      'dataBlueskyCid',
    ],
  },
}

/** Heading with a hover anchor link, using the id rehype-slug set on the node. */
function mdHeading(level: number) {
  return function Heading({ node, children }: JSX.IntrinsicElements['h2'] & ExtraProps) {
    const id = typeof node?.properties?.id === 'string' ? node.properties.id : undefined
    const Tag = `h${level}` as keyof JSX.IntrinsicElements
    return (
      <Tag id={id}>
        {children}
        {id && (
          <a className="rdr-heading-anchor" href={`#${id}`} aria-label="Link to this section">
            #
          </a>
        )}
      </Tag>
    )
  }
}

/** Collect every <a href> within a paragraph node (depth-first, in order). */
function collectHrefs(node: HastNode | undefined): string[] {
  if (!node) return []
  const out: string[] = []
  const walk = (n: HastNode) => {
    if (n.tagName === 'a' && typeof n.properties?.href === 'string') out.push(n.properties.href)
    for (const c of n.children ?? []) walk(c)
  }
  walk(node)
  return out
}

/** Pull the fenced-code text + language out of the <code> child react-markdown
 *  nests inside <pre>, so block code can route through the Shiki highlighter. */
function fencedCode(children: ReactNode): { code: string; language?: string } | null {
  const child = Array.isArray(children) ? children[0] : children
  if (!isValidElement(child)) return null
  const props = child.props as { className?: string; children?: ReactNode }
  const language = /language-([\w-]+)/.exec(props.className ?? '')?.[1]
  return { code: String(props.children ?? '').replace(/\n$/, ''), language }
}

/**
 * Render `at.markpub.markdown` content (markpub / WhiteWind-style). GFM via
 * remark-gfm; raw HTML via rehype-raw + rehype-sanitize (markpub content can
 * include inline HTML and bsky-embed blockquotes). Output is semantic HTML
 * styled by the shared `.rdr-body` rules.
 */
export function MarkdownContent({ markdown }: { markdown: string }) {
  const openLightbox = useUiStore((s) => s.openLightbox)
  return (
    <div className="rdr-body">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeSanitize, sanitizeSchema]]}
        components={{
          h2: mdHeading(2),
          h3: mdHeading(3),
          h4: mdHeading(4),
          a({ href, children }) {
            // Keep links to bsky content inside Ovoid (profiles, threads, …).
            const internal = href ? bskyUrlToInternalPath(href) : null
            if (internal) return <Link to={internal}>{children}</Link>
            return (
              <a href={href} target="_blank" rel="noopener noreferrer ugc">
                {children}
              </a>
            )
          },
          img({ src, alt }) {
            if (typeof src !== 'string') return null
            return (
              <Img
                src={src}
                alt={alt ?? ''}
                className="rdr-zoomable"
                onClick={() => openLightbox({ images: [{ src, alt }], index: 0 })}
              />
            )
          },
          pre({ children }) {
            const fenced = fencedCode(children)
            return fenced ? (
              <CodeBlock code={fenced.code} language={fenced.language} />
            ) : (
              <pre>{children}</pre>
            )
          },
          blockquote({ node, children }) {
            const uri = (node as HastNode | undefined)?.properties?.dataBlueskyUri
            if (typeof uri === 'string' && uri.startsWith('at://')) {
              return <BskyPostEmbed uri={uri} />
            }
            return <blockquote>{children}</blockquote>
          },
          p({ node, children }) {
            const urls = collectHrefs(node as HastNode | undefined)
            return (
              <>
                <p>{children}</p>
                <ContentEmbeds urls={urls} />
              </>
            )
          },
        }}
      >
        {markdown}
      </Markdown>
    </div>
  )
}
