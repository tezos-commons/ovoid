export const MAX_GRAPHEMES = 300

let _segmenter: Intl.Segmenter | null = null
function segmenter(): Intl.Segmenter | null {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter === 'undefined') return null
  if (!_segmenter) _segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return _segmenter
}

/**
 * Count user-perceived characters (graphemes), not UTF-16 code units.
 * Bluesky's 300-char limit is grapheme-based. Falls back to Array.from
 * (code points) where Intl.Segmenter is unavailable.
 */
export function graphemeCount(text: string): number {
  const seg = segmenter()
  if (!seg) return Array.from(text).length
  let n = 0
  for (const _ of seg.segment(text)) n++
  return n
}
