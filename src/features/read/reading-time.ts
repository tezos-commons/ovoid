import { isLeafletContent } from './leaflet'
import type { DocumentView } from './use-document'

function count(text: string | undefined): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

function leafletWords(content: ReturnType<typeof asLeaflet>): number {
  let n = 0
  for (const page of content.pages) {
    for (const entry of page.blocks ?? []) {
      const block = entry.block as { plaintext?: string; children?: { content?: { plaintext?: string } }[] }
      n += count(block.plaintext)
      for (const li of block.children ?? []) n += count(li.content?.plaintext)
    }
  }
  return n
}

function asLeaflet(content: unknown) {
  return content as { pages: { blocks?: { block: unknown }[] }[] }
}

/** Estimated reading minutes (≈200 wpm). 0 when there's no measurable body. */
export function readingMinutes(view: DocumentView): number {
  const { doc } = view
  let words = 0
  if (isLeafletContent(doc.content)) {
    words = leafletWords(asLeaflet(doc.content))
  } else if (doc.content?.$type === 'at.markpub.markdown') {
    const md = (doc.content.text as { markdown?: unknown } | undefined)?.markdown
    words = typeof md === 'string' ? count(md) : 0
  } else {
    words = count(doc.textContent) || count(doc.description)
  }
  return words ? Math.max(1, Math.round(words / 200)) : 0
}
