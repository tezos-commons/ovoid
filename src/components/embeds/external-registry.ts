import type { ComponentType } from 'react'
import type { ExternalEmbedProps } from './GenericExternalCard'
import { objktMatcher } from './providers/objkt'
import { teiaMatcher } from './providers/teia'

/**
 * A special renderer for external links whose URL matches `test`. This is the
 * extension point for rich, source-specific previews: add a provider module
 * under ./providers and list its matcher below, and any link it matches gets
 * its own component (which may fetch from that source's indexer). The first
 * matcher to accept a URL wins; links matching none fall back to the generic
 * link card.
 */
export interface ExternalEmbedMatcher {
  id: string
  test: (url: URL) => boolean
  Component: ComponentType<ExternalEmbedProps>
}

const EXTERNAL_MATCHERS: ExternalEmbedMatcher[] = [objktMatcher, teiaMatcher]

/** Resolve the special renderer for an external link URL, if any. */
export function matchExternal(uri: string): ExternalEmbedMatcher | undefined {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return undefined
  }
  return EXTERNAL_MATCHERS.find((m) => {
    try {
      return m.test(url)
    } catch {
      return false
    }
  })
}

export type { ExternalEmbedProps }
