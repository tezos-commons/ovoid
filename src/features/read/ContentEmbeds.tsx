import { matchExternal } from '@/components/embeds/external-registry'

/**
 * Render our rich embeds (objkt tokens/collections, teia, polls, …) for any
 * links in a paragraph that a provider recognizes. Reuses the exact same
 * matcher registry the timeline/post embeds use, so a link renders identically
 * here and in a feed. Unmatched links produce nothing (they stay inline only).
 *
 * The provider components need only `external.uri`; the other ViewExternal
 * fields are optional fallbacks, so we synthesize a minimal record.
 */
export function ContentEmbeds({ urls }: { urls: string[] }) {
  const seen = new Set<string>()
  const matched = urls
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)))
    .map((uri) => ({ uri, matcher: matchExternal(uri) }))
    .filter((m): m is { uri: string; matcher: NonNullable<typeof m.matcher> } => !!m.matcher)

  if (matched.length === 0) return null

  return (
    <div className="rdr-embeds">
      {matched.map(({ uri, matcher }) => {
        const Embed = matcher.Component
        return <Embed key={uri} external={{ uri, title: '', description: '' }} />
      })}
    </div>
  )
}
