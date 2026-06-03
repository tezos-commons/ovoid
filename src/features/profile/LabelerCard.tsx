import type { AppBskyActorDefs, ComAtprotoLabelDefs } from '@atproto/api'
import { Button, Spinner } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useLabelerService, useLabelerSubscription } from './use-labeler'

/**
 * Shown below the header when a profile is a labeler (associated.labeler). Lists
 * the labels this service can apply (from its policy definitions) and offers a
 * subscribe toggle that adds the labeler to the viewer's labelersPref so its
 * labels start appearing across the app.
 */
export function LabelerCard({ profile }: { profile: AppBskyActorDefs.ProfileViewDetailed }) {
  const { isAuthed } = useAgent()
  const service = useLabelerService(profile.did, true)
  const sub = useLabelerSubscription(profile.did)

  const view = service.data
  const defs = view?.policies.labelValueDefinitions ?? []
  // Labels with a definition render with their localized name; bare values in
  // labelValues without a definition still render as a plain chip.
  const definedIds = new Set(defs.map((d) => d.identifier))
  const bareValues = (view?.policies.labelValues ?? []).filter(
    (v) => !definedIds.has(v) && !v.startsWith('!'),
  )

  return (
    <section className="labeler-card">
      <div className="labeler-card__top">
        <div>
          <div className="labeler-card__title">Labeler</div>
          <div className="labeler-card__sub">
            {(view?.likeCount ?? 0).toLocaleString()} likes
          </div>
        </div>
        {isAuthed && (
          <Button
            variant={sub.subscribed ? 'secondary' : 'primary'}
            loading={sub.toggle.isPending || sub.isLoading}
            onClick={() => sub.toggle.mutate()}
          >
            {sub.subscribed ? 'Unsubscribe' : 'Subscribe'}
          </Button>
        )}
      </div>

      {service.isLoading ? (
        <div className="labeler-card__loading">
          <Spinner size="sm" />
        </div>
      ) : defs.length === 0 && bareValues.length === 0 ? (
        <p className="labeler-card__empty">This labeler publishes no label definitions.</p>
      ) : (
        <ul className="labeler-card__defs">
          {defs.map((d) => (
            <LabelDef key={d.identifier} def={d} />
          ))}
          {bareValues.map((v) => (
            <li key={v} className="labeler-def">
              <span className="labeler-def__name">{v.replace(/-/g, ' ')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LabelDef({ def }: { def: ComAtprotoLabelDefs.LabelValueDefinition }) {
  const loc = pickLocale(def.locales)
  return (
    <li className="labeler-def">
      <span className="labeler-def__name">{loc?.name || def.identifier.replace(/-/g, ' ')}</span>
      {loc?.description && <span className="labeler-def__desc">{loc.description}</span>}
    </li>
  )
}

function pickLocale(
  locales: ComAtprotoLabelDefs.LabelValueDefinitionStrings[],
): ComAtprotoLabelDefs.LabelValueDefinitionStrings | undefined {
  return locales.find((l) => l.lang === 'en') ?? locales[0]
}
