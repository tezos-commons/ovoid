import { useEffect, useState } from 'react'

/** The phone breakpoint — matches the layout's mobile @media value. */
const MOBILE_QUERY = '(max-width: 1000px)'

/**
 * True at phone widths. Drives layout that can't be expressed in CSS alone —
 * e.g. rendering a section menu in the main content column (so it shares the
 * feed's scroll container and can stick) on mobile vs. the aside on desktop.
 */
export function useIsMobile(): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return matches
}
