import { useEffect, useState } from 'react'

/** The wide breakpoint — matches --bp-rail in tokens.css / the layout's
 *  min-width @media value that reveals the right rail column. */
const WIDE_QUERY = '(min-width: 1400px)'

/**
 * True at very wide widths where the desktop right rail fits beside the
 * aside + 820px main column. Gates rendering the rail's React tree (and its
 * data fetches) so a hidden rail never fetches suggestions/trending — the CSS
 * column collapse alone would still mount the component.
 */
export function useIsWide(): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const mql = window.matchMedia(WIDE_QUERY)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return matches
}
