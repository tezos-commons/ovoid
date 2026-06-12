import clsx from 'clsx'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AppBskyLabelerDefs, ComAtprotoLabelDefs } from '@atproto/api'
import { LabelInfoDialog } from './LabelInfoDialog'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type Label = ComAtprotoLabelDefs.Label
type LabelerInfo = { avatar?: string; name: string }

/**
 * The `bot` label is surfaced as an icon next to the name (see BotBadge), not
 * as a chip, so it is excluded from LabelChips.
 */
export function hasBotLabel(labels?: Label[]): boolean {
  return !!labels?.some((l) => !l.neg && l.val?.toLowerCase() === 'bot')
}

/**
 * did -> {avatar,name} for the viewer's active labelers (the SDK defaults plus
 * the subscribed ones the agent carries). Used to badge each label with its
 * source labeler's logo. Keyed on the labeler set so a mid-session subscribe
 * (which mutates agent.labelers + invalidates) refetches with the new DID.
 */
export function useLabelerDirectory() {
  const { agent } = useAgent()
  const dids = [...new Set([...agent.appLabelers, ...agent.labelers])]
  return useQuery({
    queryKey: qk.labelerDirectory(dids.join(',')),
    enabled: dids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await agent.app.bsky.labeler.getServices({ dids })
      const map = new Map<string, LabelerInfo>()
      for (const v of res.data.views) {
        const c = (v as AppBskyLabelerDefs.LabelerView).creator
        if (c?.did) map.set(c.did, { avatar: c.avatar, name: c.displayName || c.handle })
      }
      return map
    },
  })
}

/**
 * Renders content labels as chips, each badged with the logo of the labeler
 * that emitted it. System behaviour labels (`!hide`, …) and negations are
 * dropped; the rest are deduped by (src, val). Renders nothing when empty.
 * Tapping a chip opens LabelInfoDialog — the label's definition and source
 * labeler (modal on desktop, bottom sheet on mobile).
 */
export function LabelChips({
  labels,
  className,
}: {
  labels?: Label[]
  className?: string
}) {
  const dir = useLabelerDirectory()
  const [selected, setSelected] = useState<Label | null>(null)
  if (!labels || labels.length === 0) return null

  const seen = new Set<string>()
  const items = labels.filter((l) => {
    if (!l.val || l.val.startsWith('!') || l.neg) return false
    if (l.val.toLowerCase() === 'bot') return false // shown as a name badge instead
    const key = `${l.src}:${l.val}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (items.length === 0) return null

  return (
    <div className={clsx('label-chips', className)}>
      {items.map((l) => {
        const info = dir.data?.get(l.src)
        const text = l.val.replace(/-/g, ' ')
        return (
          <button
            key={`${l.src}:${l.val}`}
            type="button"
            className="label-chip"
            title={info?.name ? `${text} — ${info.name}` : text}
            onClick={(e) => {
              // Chips render inside PostCard rows whose click opens the thread.
              e.stopPropagation()
              setSelected(l)
            }}
          >
            {info?.avatar && (
              <img className="label-chip__logo" src={info.avatar} alt="" loading="lazy" />
            )}
            {text}
          </button>
        )
      })}
      {selected && (
        <LabelInfoDialog label={selected} open onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
