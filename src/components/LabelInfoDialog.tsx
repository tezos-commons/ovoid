import type { AppBskyLabelerDefs, ComAtprotoLabelDefs } from '@atproto/api'
import { Link } from 'react-router-dom'
import { Avatar } from './Avatar'
import { ModalSheet } from './ModalSheet'
import { Spinner } from './Spinner'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { profileOptions } from '@/features/profile/use-profile'
import { useLabelerService } from '@/features/profile/use-labeler'

type Label = ComAtprotoLabelDefs.Label

/** The labeler's localized strings for a label, preferring the UI language. */
function pickLocale(
  def: ComAtprotoLabelDefs.LabelValueDefinition | undefined,
): ComAtprotoLabelDefs.LabelValueDefinitionStrings | undefined {
  if (!def || def.locales.length === 0) return undefined
  const lang = navigator.language?.split('-')[0]
  return def.locales.find((l) => l.lang?.startsWith(lang)) ?? def.locales[0]
}

/**
 * What a label means and who applied it: the labeler's own definition (name,
 * description, behaviour flags) plus the labeler's identity, linking to its
 * profile. Modal on desktop, content-height bottom sheet on mobile.
 */
export function LabelInfoDialog({
  label,
  open,
  onClose,
}: {
  label: Label
  open: boolean
  onClose: () => void
}) {
  const service = useLabelerService(label.src, open)
  const view = service.data
  const def = view?.policies.labelValueDefinitions?.find((d) => d.identifier === label.val)
  const strings = pickLocale(def)
  const fallbackName = label.val.replace(/-/g, ' ')

  const flags = [
    def?.severity === 'alert' ? 'Warning' : def?.severity === 'inform' ? 'Informational' : null,
    def?.blurs === 'content' ? 'Hides content' : def?.blurs === 'media' ? 'Hides media' : null,
    def?.adultOnly ? 'Adult only' : null,
  ].filter(Boolean) as string[]

  return (
    <ModalSheet open={open} onClose={onClose} title="Content label">
      <div className="labelinfo">
        <div>
          <div className="labelinfo__name">{strings?.name || fallbackName}</div>
          <p className="labelinfo__desc">
            {strings?.description ||
              'This label was applied by a moderation service. It has no published description.'}
          </p>
          {flags.length > 0 && (
            <div className="labelinfo__flags">
              {flags.map((f) => (
                <span key={f} className="labelinfo__flag">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {service.isLoading ? (
          <div className="labelinfo__loading">
            <Spinner size="sm" />
          </div>
        ) : view?.creator ? (
          <LabelerLink creator={view.creator} onNavigate={onClose} />
        ) : null}
      </div>
    </ModalSheet>
  )
}

/**
 * The labeler's identity card, linking to its profile (where LabelerCard shows
 * its full policy list). Warms the profile query on visibility — keyed by
 * handle-first actor, the same key the /profile route will read.
 */
function LabelerLink({
  creator,
  onNavigate,
}: {
  creator: AppBskyLabelerDefs.LabelerView['creator']
  onNavigate: () => void
}) {
  const { agent } = useAgent()
  const actor = creator.handle || creator.did
  const ref = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const profile = profileOptions(agent, actor)
    schedulePrefetch(profile.queryKey, () => queryClient.prefetchQuery(profile))
  })
  return (
    <Link ref={ref} to={`/profile/${actor}`} className="labelinfo__labeler" onClick={onNavigate}>
      <Avatar
        src={creator.avatar}
        alt={creator.displayName || creator.handle}
        fallback={creator.displayName || creator.handle}
        size="sm"
        shape="rounded-square"
      />
      <span className="labelinfo__labeler-meta">
        <span className="labelinfo__labeler-name">{creator.displayName || creator.handle}</span>
        <span className="labelinfo__labeler-sub">Applied by @{creator.handle} · view labeler</span>
      </span>
    </Link>
  )
}
