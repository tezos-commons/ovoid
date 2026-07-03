// Self-hosted Inter (variable, wght 100–900 + true italics). Fontsource ships
// per-script subsets with unicode-range, so browsers fetch only the subsets a
// page actually renders (latin ≈ 48 KB) — same slicing Google Fonts did, but
// bundled first-party: no third-party origin, no CSS @import waterfall, and
// the hashed /assets files ride the service worker's cache-first route.
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/inter/wght-italic.css'

import './tokens.css'
import './globals.css'
