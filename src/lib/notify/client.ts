import type { Agent } from '@atproto/api'

/**
 * Client for the Ovoid notify service (../../notify in the repo) — our own
 * push backend. It holds NO user credentials: every call is authenticated
 * with a single-purpose atproto service-auth JWT minted by the user's PDS
 * (com.atproto.server.getServiceAuth) with aud = the service DID and
 * lxm = the endpoint NSID, so a token is spendable on exactly one endpoint
 * and expires in ~60s.
 */

/** Base URL of the notify service. Push UI is hidden when unset. */
export const NOTIFY_URL = (import.meta.env.VITE_NOTIFY_URL ?? '').replace(/\/+$/, '')
/** The service's DID — the `aud` of every minted token. */
export const NOTIFY_DID = import.meta.env.VITE_NOTIFY_DID ?? ''

export function notifyConfigured(): boolean {
  return NOTIFY_URL !== '' && NOTIFY_DID !== ''
}

export interface NotifyPrefs {
  reply: boolean
  mention: boolean
  quote: boolean
  like: boolean
  repost: boolean
  follow: boolean
  watchedPost: boolean
  chat: boolean
}

/**
 * Complete prefs object, everything on (the backend's defaults). Spread under
 * any partial/stale prefs before mutating so an object persisted with an
 * older shape (e.g. pre-`chat`) never reaches the backend with fields
 * missing — Go decodes an absent bool as false, which would silently disable
 * that reason.
 */
export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  reply: true,
  mention: true,
  quote: true,
  like: true,
  repost: true,
  follow: true,
  watchedPost: true,
  chat: true,
}

export interface ChatStatus {
  /** Chat push is configured on the deployment. */
  available: boolean
  /** This account has an active chat OAuth session on the backend. */
  connected: boolean
}

export interface NotifyDevice {
  endpoint: string
  platform: string
  label: string
  createdAt: number
}

export interface NotifyWatch {
  subject: string
  posts: boolean
  replies: boolean
}

async function call<T>(
  agent: Agent,
  method: 'GET' | 'POST',
  nsid: string,
  body?: unknown,
): Promise<T> {
  const {
    data: { token },
  } = await agent.com.atproto.server.getServiceAuth({ aud: NOTIFY_DID, lxm: nsid })
  const res = await fetch(`${NOTIFY_URL}/xrpc/${nsid}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`notify ${nsid}: ${res.status}`)
  }
  return (await res.json()) as T
}

/** Public — no auth; needed before any subscription exists. */
export async function getVapidKey(): Promise<string> {
  const res = await fetch(`${NOTIFY_URL}/xrpc/app.ovoid.notify.getVapidKey`)
  if (!res.ok) throw new Error(`notify getVapidKey: ${res.status}`)
  const { key } = (await res.json()) as { key: string }
  return key
}

export function registerDevice(
  agent: Agent,
  subscription: PushSubscriptionJSON,
  platform: string,
  label: string,
): Promise<{ ok: boolean }> {
  return call(agent, 'POST', 'app.ovoid.notify.registerDevice', {
    subscription,
    platform,
    label,
  })
}

export function unregisterDevice(agent: Agent, endpoint: string): Promise<{ ok: boolean }> {
  return call(agent, 'POST', 'app.ovoid.notify.unregisterDevice', { endpoint })
}

export function listDevices(agent: Agent): Promise<NotifyDevice[]> {
  return call<{ devices: NotifyDevice[] }>(agent, 'GET', 'app.ovoid.notify.listDevices').then(
    (r) => r.devices,
  )
}

export function getPreferences(agent: Agent): Promise<NotifyPrefs> {
  return call<{ preferences: NotifyPrefs }>(agent, 'GET', 'app.ovoid.notify.getPreferences').then(
    (r) => ({ ...DEFAULT_NOTIFY_PREFS, ...r.preferences }),
  )
}

export function putPreferences(agent: Agent, preferences: NotifyPrefs): Promise<NotifyPrefs> {
  return call<{ preferences: NotifyPrefs }>(agent, 'POST', 'app.ovoid.notify.putPreferences', {
    preferences,
  }).then((r) => r.preferences)
}

export function listWatches(agent: Agent): Promise<NotifyWatch[]> {
  return call<{ watches: NotifyWatch[] }>(agent, 'GET', 'app.ovoid.notify.listWatches').then(
    (r) => r.watches,
  )
}

export function putWatch(agent: Agent, watch: NotifyWatch): Promise<{ ok: boolean }> {
  return call(agent, 'POST', 'app.ovoid.notify.putWatch', watch)
}

export function listMutes(agent: Agent): Promise<string[]> {
  return call<{ mutes: string[] }>(agent, 'GET', 'app.ovoid.notify.listMutes').then((r) => r.mutes)
}

export function putMute(agent: Agent, subject: string, muted: boolean): Promise<{ ok: boolean }> {
  return call(agent, 'POST', 'app.ovoid.notify.putMute', { subject, muted })
}

export function sendTest(agent: Agent): Promise<{ devices: number }> {
  return call(agent, 'POST', 'app.ovoid.notify.sendTest', {})
}

/**
 * Thread notification mutes, keyed by the thread ROOT's at-uri. Muting
 * suppresses every notification belonging to that thread (replies, mentions,
 * and likes/reposts/quotes of your posts within it).
 */
export function listThreadMutes(agent: Agent): Promise<string[]> {
  return call<{ roots: string[] }>(agent, 'GET', 'app.ovoid.notify.listThreadMutes').then(
    (r) => r.roots,
  )
}

export function putThreadMute(
  agent: Agent,
  root: string,
  muted: boolean,
): Promise<{ ok: boolean }> {
  return call(agent, 'POST', 'app.ovoid.notify.putThreadMute', { root, muted })
}

/* ---- chat push (opt-in: separate OAuth grant scoped to DMs only) ---- */

export function getChatStatus(agent: Agent): Promise<ChatStatus> {
  return call(agent, 'GET', 'app.ovoid.notify.getChatStatus')
}

/** Returns the authorize URL; navigate the browser there to grant DM access. */
export function startChatAuth(agent: Agent): Promise<string> {
  return call<{ url: string }>(agent, 'POST', 'app.ovoid.notify.startChatAuth', {}).then(
    (r) => r.url,
  )
}

export function disconnectChat(agent: Agent): Promise<{ ok: boolean }> {
  return call(agent, 'POST', 'app.ovoid.notify.disconnectChat', {})
}

export function listConvoMutes(agent: Agent): Promise<string[]> {
  return call<{ convoIds: string[] }>(agent, 'GET', 'app.ovoid.notify.listConvoMutes').then(
    (r) => r.convoIds,
  )
}

export function putConvoMute(
  agent: Agent,
  convoId: string,
  muted: boolean,
): Promise<{ ok: boolean }> {
  return call(agent, 'POST', 'app.ovoid.notify.putConvoMute', { convoId, muted })
}
