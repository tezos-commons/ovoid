import type { Agent, AppBskyActorDefs } from '@atproto/api'

export type Prefs = AppBskyActorDefs.Preferences

/** Fetch the full preferences array. */
export async function getPrefs(agent: Agent): Promise<Prefs> {
  const res = await agent.app.bsky.actor.getPreferences()
  return res.data.preferences
}

const LABELERS_PREF = 'app.bsky.actor.defs#labelersPref'

/**
 * The DIDs of the user's subscribed labelers, read out of the labelersPref
 * entry. These must be passed to `agent.configureLabelers` so the AppView
 * returns those labelers' labels (via the `atproto-accept-labelers` header).
 * The default Bluesky moderation labeler is added separately by the SDK
 * (Agent.appLabelers), so it is not included here.
 */
export function selectLabelerDids(prefs: Prefs): string[] {
  const entry = prefs.find((p) => p.$type === LABELERS_PREF) as
    | (AppBskyActorDefs.LabelersPref & { labelers?: { did: string }[] })
    | undefined
  return entry?.labelers?.map((l) => l.did).filter(Boolean) ?? []
}

/**
 * Read-modify-write a single preference entry by $type.
 *
 * Preferences are a single array the server replaces wholesale, so we must send
 * the entire array back. This helper finds the entry of the given $type (or
 * undefined if absent), runs `mutate`, and writes the array with that one slot
 * replaced — preserving all other entries.
 *
 * Concurrency invariant: the whole read→modify→write cycle is serialized
 * through a module-level chain. Without it, two concurrent updates (e.g. pin a
 * feed + subscribe to a labeler) both read the same array snapshot and the
 * second putPreferences clobbers the first — last-write-wins on the WHOLE array.
 * Serializing guarantees each cycle observes the previous write. This is the
 * single choke point for every preference mutation, so all callers are covered.
 */
let prefsWriteChain: Promise<unknown> = Promise.resolve()

export function updatePref<T extends { $type?: string }>(
  agent: Agent,
  $type: NonNullable<T['$type']>,
  mutate: (entry: T | undefined) => T,
): Promise<void> {
  const run = async (): Promise<void> => {
    const prefs = await getPrefs(agent)
    const idx = prefs.findIndex((p) => p.$type === $type)
    const current = idx >= 0 ? (prefs[idx] as unknown as T) : undefined
    const next = mutate(current)
    const updated = prefs.slice()
    if (idx >= 0) {
      updated[idx] = next as unknown as Prefs[number]
    } else {
      updated.push(next as unknown as Prefs[number])
    }
    await agent.app.bsky.actor.putPreferences({ preferences: updated })
  }
  // Chain onto the previous write regardless of its outcome (run on both
  // fulfilment and rejection), so one failed write doesn't wedge the queue.
  const result = prefsWriteChain.then(run, run)
  prefsWriteChain = result.catch(() => {})
  return result
}
