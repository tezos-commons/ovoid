import type { Agent } from '@atproto/api'
import { getVapidKey, registerDevice, unregisterDevice } from './client'

/**
 * Browser push subscription plumbing.
 *
 * Platform reality this encodes:
 *  - iOS/iPadOS exposes PushManager ONLY to web apps installed to the Home
 *    Screen ('needs-install'), and permission must be requested inside a
 *    user-gesture handler — enablePush() must only ever run from a click.
 *  - Everywhere else (desktop Chrome/Firefox/Edge/Safari 16.1+, Android)
 *    a plain browser tab can subscribe.
 */

export type PushSupport = 'ok' | 'needs-install' | 'unsupported'

function isIOS(): boolean {
  // iPadOS 13+ reports MacIntel + touch; real macs have no touch points.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari legacy flag
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

export function pushSupport(): PushSupport {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return 'unsupported'
  if (!('PushManager' in window)) {
    // iOS outside an installed app has no PushManager — installing fixes it.
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (isIOS() && !isStandalone()) return 'needs-install'
  return 'ok'
}

export function permissionState(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied'
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  const browser = /Firefox\//.test(ua)
    ? 'Firefox'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = isIOS()
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac/.test(navigator.platform)
        ? 'macOS'
        : /Win/.test(navigator.platform)
          ? 'Windows'
          : 'Linux'
  return `${browser} on ${os}`
}

function platform(): string {
  if (isIOS()) return 'ios'
  if (/Android/.test(navigator.userAgent)) return 'android'
  return 'web'
}

/** localStorage key remembering the endpoint we last registered upstream. */
const REGISTERED_KEY = 'ovoid:push-endpoint'

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/**
 * Full enable flow. MUST be called from a user-gesture handler (iOS rejects
 * the permission prompt otherwise). Throws on denial/failure.
 */
export async function enablePush(agent: Agent): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('permission-denied')
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const key = await getVapidKey()
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    })
  }
  await registerDevice(agent, sub.toJSON(), platform(), deviceLabel())
  localStorage.setItem(REGISTERED_KEY, sub.endpoint)
  return sub
}

/** Tear down this device's subscription (browser + backend). */
export async function disablePush(agent: Agent): Promise<void> {
  const sub = await getCurrentSubscription()
  if (!sub) {
    localStorage.removeItem(REGISTERED_KEY)
    return
  }
  // Backend first: if unregister fails we keep local state so a retry is
  // possible; a browser-only unsubscribe would strand a dead row upstream
  // (eventually pruned via 410, so still recoverable).
  await unregisterDevice(agent, sub.endpoint)
  await sub.unsubscribe()
  localStorage.removeItem(REGISTERED_KEY)
}

/**
 * Re-sync after boot: if the browser rotated the subscription (or a
 * pushsubscriptionchange happened while we weren't looking), re-register the
 * new endpoint. No-ops without network in the common case (endpoint matches
 * what we last registered).
 */
export async function syncPushRegistration(agent: Agent): Promise<void> {
  if (pushSupport() !== 'ok' || permissionState() !== 'granted') return
  const sub = await getCurrentSubscription()
  if (!sub) return
  if (localStorage.getItem(REGISTERED_KEY) === sub.endpoint) return
  await registerDevice(agent, sub.toJSON(), platform(), deviceLabel())
  localStorage.setItem(REGISTERED_KEY, sub.endpoint)
}
