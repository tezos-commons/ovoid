import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Button } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { useCanInstall, promptInstall } from '@/lib/install'
import {
  DEFAULT_NOTIFY_PREFS,
  disconnectChat,
  notifyConfigured,
  sendTest,
  startChatAuth,
  unregisterDevice,
  type NotifyPrefs,
} from '@/lib/notify/client'
import {
  disablePush,
  enablePush,
  getCurrentSubscription,
  permissionState,
  pushSupport,
} from '@/lib/notify/push'
import {
  useNotifyChatStatus,
  useNotifyDevices,
  useNotifyMutes,
  useNotifyPrefs,
  useNotifyThreadMutes,
  usePutNotifyMute,
  usePutNotifyPrefs,
  usePutThreadMute,
} from '@/lib/notify/use-notify'
import { Section, Row, Switch } from './components'

const REASON_ROWS: Array<{ key: keyof NotifyPrefs; label: string; sub?: string }> = [
  { key: 'reply', label: 'Replies', sub: 'Someone replies to your post' },
  { key: 'mention', label: 'Mentions', sub: 'Someone mentions you' },
  { key: 'quote', label: 'Quotes', sub: 'Someone quotes your post' },
  { key: 'like', label: 'Likes' },
  { key: 'repost', label: 'Reposts' },
  { key: 'follow', label: 'New followers' },
  {
    key: 'watchedPost',
    label: 'Watched accounts',
    sub: 'Posts from accounts you ring the bell for',
  },
  {
    key: 'chat',
    label: 'Direct messages',
    sub: 'New messages in DMs and groups (requires connecting below)',
  },
]

/**
 * Push notification settings, backed by the Ovoid notify service — these are
 * Ovoid's own notification preferences, fully separate from the Bluesky app's.
 * The master toggle owns this device's push subscription; per-reason switches
 * and mutes are account-wide (they live on the backend, keyed by DID).
 */
export default function NotificationSettings() {
  return (
    <>
      <ScreenHeader title="Notifications" showBack />
      <div className="settings">
        {notifyConfigured() ? (
          <ConfiguredBody />
        ) : (
          <Section title="Push notifications">
            <Row
              label="Not available"
              sub="This deployment has no notification service configured (VITE_NOTIFY_URL / VITE_NOTIFY_DID)."
            />
          </Section>
        )}
      </div>
    </>
  )
}

function ConfiguredBody() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const support = pushSupport()

  // This device's subscription state. `undefined` = still resolving (keeps
  // the master switch from flashing off→on while the SW registration settles).
  const [subEndpoint, setSubEndpoint] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    getCurrentSubscription()
      .then((sub) => {
        if (!cancelled) setSubEndpoint(sub?.endpoint ?? null)
      })
      .catch(() => {
        if (!cancelled) setSubEndpoint(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enabled = !!subEndpoint && permissionState() === 'granted'
  const denied = permissionState() === 'denied'

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) {
        const sub = await enablePush(agent)
        return sub.endpoint
      }
      await disablePush(agent)
      return null
    },
    onSuccess: (endpoint) => {
      setSubEndpoint(endpoint)
      void qc.invalidateQueries({ queryKey: qk.notifyDevices(did) })
    },
  })

  const test = useMutation({ mutationFn: () => sendTest(agent) })

  return (
    <>
      <Section title="Push notifications">
        {support === 'unsupported' && (
          <Row
            label="Not supported in this browser"
            sub="This browser doesn't support web push notifications."
          />
        )}
        {support === 'needs-install' && (
          <Row
            label="Install Ovoid first"
            sub="On iOS, notifications are only available to installed apps: open the share menu in Safari, choose “Add to Home Screen”, then enable notifications from inside the installed app."
          />
        )}
        {support === 'ok' && (
          <>
            <Row
              label="Enable on this device"
              sub={
                denied
                  ? 'Notifications are blocked for this site — re-allow them in your browser settings, then try again.'
                  : toggle.error
                    ? 'Could not enable notifications. Please try again.'
                    : 'Receive push notifications even when Ovoid is closed.'
              }
              trailing={
                <Switch
                  label="Enable push notifications"
                  checked={enabled}
                  onChange={(next) => {
                    if (subEndpoint === undefined || toggle.isPending || denied) return
                    toggle.mutate(next)
                  }}
                />
              }
            />
            {enabled && (
              <Row
                label="Send a test notification"
                sub={
                  test.isSuccess
                    ? test.data.devices > 0
                      ? `Sent to ${test.data.devices} device${test.data.devices === 1 ? '' : 's'} — it should arrive within a few seconds.`
                      : 'No devices are registered for this account — toggle push off and on again to re-register this one.'
                    : undefined
                }
                trailing={
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={test.isPending}
                    onClick={() => test.mutate()}
                  >
                    Test
                  </Button>
                }
              />
            )}
          </>
        )}
      </Section>

      <PrefsSection />
      <ChatSection />
      <DevicesSection
        thisEndpoint={subEndpoint ?? null}
        // Removing THIS device must run the full disable flow (backend row +
        // browser subscription + local state) or the master switch above
        // keeps showing "on" against a dead registration.
        onRemoveSelf={() => toggle.mutate(false)}
        removingSelf={toggle.isPending}
      />
      <MutesSection />
      <MutedThreadsSection />
      <InstallSection />
    </>
  )
}

/**
 * DM/group push needs more than the firehose: an opt-in OAuth grant scoped to
 * transition:chat.bsky that the backend polls with. This section owns that
 * connect/disconnect lifecycle. The OAuth callback bounces back here with
 * ?chat=connected|error|denied.
 */
function ChatSection() {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const { data: status } = useNotifyChatStatus()
  const [searchParams, setSearchParams] = useSearchParams()
  const callbackResult = searchParams.get('chat')

  // The callback landed: reconcile status and consume the query param so a
  // refresh doesn't re-show a stale banner.
  useEffect(() => {
    if (!callbackResult) return
    void qc.invalidateQueries({ queryKey: qk.notifyChatStatus(did) })
    const next = new URLSearchParams(searchParams)
    next.delete('chat')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = useMutation({
    mutationFn: () => startChatAuth(agent),
    onSuccess: (url) => {
      window.location.href = url
    },
  })
  const disconnect = useMutation({
    mutationFn: () => disconnectChat(agent),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notifyChatStatus(did) }),
  })

  if (!status?.available) return null

  const note =
    callbackResult === 'connected'
      ? 'Connected — message notifications are on.'
      : callbackResult === 'denied'
        ? 'Authorization was declined.'
        : callbackResult === 'error'
          ? 'Connecting failed. Please try again.'
          : undefined

  return (
    <Section
      title="Direct messages"
      desc="Messages aren't on the public network feed, so push for DMs needs a separate authorization that only grants chat access. You can revoke it here or from your PDS at any time."
    >
      {status.connected ? (
        <Row
          label="Connected"
          sub={note ?? 'The notification service can watch your chats for new messages.'}
          trailing={
            <Button
              variant="secondary"
              size="sm"
              loading={disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              Disconnect
            </Button>
          }
        />
      ) : (
        <Row
          label="Not connected"
          sub={
            note ??
            'Authorize the notification service (chat access only) to get pushes for new messages.'
          }
          trailing={
            <Button
              variant="primary"
              size="sm"
              loading={connect.isPending}
              onClick={() => connect.mutate()}
            >
              Connect
            </Button>
          }
        />
      )}
    </Section>
  )
}

/** at://did/app.bsky.feed.post/rkey → app path, or null for foreign shapes. */
function threadPath(root: string): string | null {
  const m = root.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/)
  return m ? `/profile/${m[1]}/post/${m[2]}` : null
}

function MutedThreadsSection() {
  const { data: roots } = useNotifyThreadMutes()
  const put = usePutThreadMute()

  if (!roots?.length) return null
  return (
    <Section
      title="Muted threads"
      desc="Threads you won't get notifications about. Mute from the “Mute thread” button on any post in a thread."
    >
      {roots.map((root) => {
        const path = threadPath(root)
        return (
          <Row
            key={root}
            label={path ? <Link to={path}>{root.split('/').pop()}</Link> : root}
            sub={root.replace('at://', '').split('/')[0]}
            trailing={
              <Button
                variant="secondary"
                size="sm"
                loading={put.isPending && put.variables?.root === root}
                onClick={() => put.mutate({ root, muted: false })}
              >
                Unmute
              </Button>
            }
          />
        )
      })}
    </Section>
  )
}

/** Android/desktop Chromium banks an install prompt; iOS uses the share sheet. */
function InstallSection() {
  const canInstall = useCanInstall()
  if (!canInstall) return null
  return (
    <Section title="App">
      <Row
        label="Install Ovoid"
        sub="Add Ovoid as an app — notifications work even with the browser closed."
        trailing={
          <Button variant="secondary" size="sm" onClick={() => void promptInstall()}>
            Install
          </Button>
        }
      />
    </Section>
  )
}

function PrefsSection() {
  const { data: prefs } = useNotifyPrefs()
  const put = usePutNotifyPrefs()

  return (
    <Section
      title="Notify me about"
      desc="These apply to every device you've enabled, and are separate from the official Bluesky app's notification settings."
    >
      {REASON_ROWS.map(({ key, label, sub }) => (
        <Row
          key={key}
          label={label}
          sub={sub}
          trailing={
            <Switch
              label={label}
              checked={prefs?.[key] ?? true}
              onChange={(next) => {
                if (!prefs) return
                // defaults first: a disk-restored prefs object from an older
                // shape must not reach the backend with fields missing
                put.mutate({ ...DEFAULT_NOTIFY_PREFS, ...prefs, [key]: next })
              }}
            />
          }
        />
      ))}
    </Section>
  )
}

function DevicesSection({
  thisEndpoint,
  onRemoveSelf,
  removingSelf,
}: {
  thisEndpoint: string | null
  onRemoveSelf: () => void
  removingSelf: boolean
}) {
  const { agent, did } = useAgent()
  const qc = useQueryClient()
  const { data: devices } = useNotifyDevices()

  const remove = useMutation({
    mutationFn: (endpoint: string) => unregisterDevice(agent, endpoint),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notifyDevices(did) }),
  })

  if (!devices?.length) return null
  return (
    <Section title="Devices" desc="Everywhere push is enabled for this account.">
      {devices.map((d) => {
        const isSelf = d.endpoint === thisEndpoint
        return (
          <Row
            key={d.endpoint}
            label={d.label || d.platform || 'Device'}
            sub={
              (isSelf ? 'This device · ' : '') +
              `added ${new Date(d.createdAt * 1000).toLocaleDateString()}`
            }
            trailing={
              <Button
                variant="secondary"
                size="sm"
                loading={
                  isSelf ? removingSelf : remove.isPending && remove.variables === d.endpoint
                }
                onClick={() => (isSelf ? onRemoveSelf() : remove.mutate(d.endpoint))}
              >
                Remove
              </Button>
            }
          />
        )
      })}
    </Section>
  )
}

function MutesSection() {
  const { data: mutes } = useNotifyMutes()
  const putMuteM = usePutNotifyMute()

  if (!mutes?.length) return null
  return (
    <Section
      title="Muted accounts"
      desc="Accounts you never want notifications about (Ovoid-only — independent of Bluesky mutes). Mute from the ⋯ menu on a profile."
    >
      {mutes.map((subjectDid) => (
        <Row
          key={subjectDid}
          label={subjectDid}
          trailing={
            <Button
              variant="secondary"
              size="sm"
              loading={putMuteM.isPending && putMuteM.variables?.subject === subjectDid}
              onClick={() => putMuteM.mutate({ subject: subjectDid, muted: false })}
            >
              Unmute
            </Button>
          }
        />
      ))}
    </Section>
  )
}
