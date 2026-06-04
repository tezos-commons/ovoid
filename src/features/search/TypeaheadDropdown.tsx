import { PeopleSkeleton, Icons } from '@/components'
import { useTypeahead } from './use-typeahead'
import { PersonCard } from './PersonCard'

export interface TypeaheadDropdownProps {
  query: string
  /** Called when the user picks the "Search for …" affordance or a person. */
  onSubmitSearch: () => void
  onPick: () => void
}

/**
 * The people-typeahead panel shown under the search input while typing.
 * Top row is always a "Search for <q>" action (submits the full search);
 * below it, up to N actor matches. Hidden entirely when the term is empty.
 */
export function TypeaheadDropdown({ query, onSubmitSearch, onPick }: TypeaheadDropdownProps) {
  const { actors, isLoading, active } = useTypeahead(query)
  if (!active) return null

  return (
    <div className="typeahead" role="listbox">
      <button className="typeahead__search" onClick={onSubmitSearch} role="option">
        <Icons.SearchIcon size={18} />
        <span>
          Search for <strong>{query.trim()}</strong>
        </span>
      </button>

      {isLoading && actors.length === 0 && <PeopleSkeleton count={4} compact />}

      {actors.map((actor) => (
        <PersonCard key={actor.did} actor={actor} compact onNavigate={onPick} />
      ))}
    </div>
  )
}
