import { create } from 'zustand'

export type ConsentKind = 'viewer' | 'serviceAuth' | 'post' | 'like' | 'repost' | 'follow'

export interface ConsentRequest {
  kind: ConsentKind
  /** Exact frame origin (per-CID subdomain) the request came from. */
  origin: string
  /** Artifact title, if the host surface knows one. Attacker-controlled text —
   *  the dialog always shows the origin alongside it. */
  title?: string
  /** serviceAuth only: the DID the token would be minted for. */
  aud?: string
  /** post only: the exact text that would be published. */
  postText?: string
  /** like/repost/follow: what the action targets, resolved by the host —
   *  never taken from the artifact's own claims. */
  subject?: { handle: string; text?: string; displayName?: string }
}

interface PendingConsent extends ConsentRequest {
  resolve: (granted: boolean) => void
}

interface ConsentState {
  /** The request currently shown in the dialog; further asks queue behind it. */
  current: PendingConsent | null
  queue: PendingConsent[]
  ask: (req: ConsentRequest) => Promise<boolean>
  decide: (granted: boolean) => void
}

// Only read-ish grants are remembered for the session (keyed by exactly what
// was shown to the user). Write actions (post/like/repost/follow) must prompt
// EVERY time — a remembered "always allow posts" would let an artifact publish
// silently. Denials are never stored here — the bridge rate-limits re-asks per
// frame connection, so closing and reopening an artifact allows a fresh decision.
const REMEMBERED_KINDS: ReadonlySet<ConsentKind> = new Set(['viewer', 'serviceAuth'])
const grants = new Set<string>()
const grantKey = (r: ConsentRequest) => `${r.origin}|${r.kind}|${r.aud ?? ''}`

export const useConsentStore = create<ConsentState>((set, get) => ({
  current: null,
  queue: [],
  ask(req) {
    if (REMEMBERED_KINDS.has(req.kind) && grants.has(grantKey(req))) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      const pending: PendingConsent = { ...req, resolve }
      if (get().current) set((s) => ({ queue: [...s.queue, pending] }))
      else set({ current: pending })
    })
  },
  decide(granted) {
    const { current, queue } = get()
    if (!current) return
    if (granted && REMEMBERED_KINDS.has(current.kind)) grants.add(grantKey(current))
    set({ current: queue[0] ?? null, queue: queue.slice(1) })
    current.resolve(granted)
  },
}))
