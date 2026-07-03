import { Avatar, Spinner } from '@/components'
import { useTypeahead } from '@/features/search/use-typeahead'
import './auth.css'

export interface HandleSuggestProps {
  /** Raw input value; the list hides itself when it's empty. */
  query: string
  /** Fills the input with the chosen handle (does not submit). */
  onPick: (handle: string) => void
}

/**
 * Actor suggestions under a handle input (login + add-account). Reuses the
 * search typeahead query — which resolves through the public AppView when
 * signed out, so it works on the login screen too. Picking a row only fills
 * the field; the user still confirms before the OAuth redirect.
 */
export function HandleSuggest({ query, onPick }: HandleSuggestProps) {
  const { actors, isLoading, active } = useTypeahead(query, 5)
  if (!active || (!isLoading && actors.length === 0)) return null

  return (
    <div className="handle-suggest" role="listbox" aria-label="Matching accounts">
      {isLoading && actors.length === 0 ? (
        <div className="handle-suggest__loading">
          <Spinner size="sm" />
        </div>
      ) : (
        actors.map((a) => (
          <button
            key={a.did}
            type="button"
            role="option"
            aria-selected={false}
            className="handle-suggest__row"
            onClick={() => onPick(a.handle)}
          >
            <Avatar size="sm" src={a.avatar} alt={a.handle} fallback={a.displayName || a.handle} />
            <span className="handle-suggest__names">
              <span className="handle-suggest__name">{a.displayName || a.handle}</span>
              <span className="handle-suggest__handle">@{a.handle}</span>
            </span>
          </button>
        ))
      )}
    </div>
  )
}
