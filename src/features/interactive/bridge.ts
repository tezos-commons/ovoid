import { useEffect, useRef, type RefObject } from 'react'
import { RichText } from '@atproto/api'
import { useQueryClient } from '@tanstack/react-query'
import { useAgent } from '@/lib/api/agent'
import { interactiveFrameOrigin } from '@/lib/ipfs'
import { profileOptions } from '@/features/profile/use-profile'
import { tezosAddressOptions } from '@/features/profile/use-nfts'
import { useConsentStore, type ConsentKind, type ConsentRequest } from './consent-store'
import { useWalletOpStore } from './wallet-op-store'
import type { TezosOp } from '@/lib/tezos/wallet-session'

/**
 * Host side of the interactive-artifact bridge (protocol v1).
 *
 * A sandboxed artifact can't see who embeds it, so it broadcasts a content-free
 * `{ovoid:1, type:'ready'}` to window.parent until we answer with a `hello`
 * carrying a MessagePort; requests then flow over that private port:
 *
 *   → { ovoid:1, id, type:'viewer' }
 *   → { ovoid:1, id, type:'serviceAuth', aud, lxm?, expSec? }
 *   → { ovoid:1, id, type:'post', text }          (returns {uri, cid})
 *   → { ovoid:1, id, type:'like'|'repost', uri }  (returns {uri[, existing]})
 *   → { ovoid:1, id, type:'follow', actor }       (returns {did, uri[, existing]})
 *   → { ovoid:1, id, type:'tezosOperation', ops } (returns {opHash})
 *   ← { ovoid:1, id, ok:true, data } | { ovoid:1, id, ok:false, error }
 *
 * Reads (viewer/serviceAuth) may be consent-remembered for the session; writes
 * (post/like/repost/follow/tezosOperation) prompt on EVERY call, the dialog
 * showing the exact text or the host-resolved target — never the artifact's own
 * description of it.
 *
 * `tezosOperation` forwards a batch of Tezos operations to the user's wallet
 * through the app-wide wallet session, but ONLY against the user's linked
 * address (the tz we hand apps via `viewer`): the dialog verifies the connected
 * wallet matches, prompts to connect that specific wallet otherwise, and the
 * wallet's own confirmation is the final signing gate. The artifact never
 * touches the wallet transport and can't spoof what the wallet displays.
 *
 * The trust anchor is the frame's origin: `interactiveFrameOrigin` derives the
 * per-CID subdomain origin from the iframe src, every inbound message must
 * match it exactly (plus event.source === our contentWindow), and every
 * outbound postMessage pins it as targetOrigin. Origin = CID = immutable code,
 * so consent binds to *which artifact* is asking, not wherever the frame may
 * have navigated. Frames without a derivable per-CID origin get no bridge.
 *
 * `viewer` shares public identity (handle/DID/display name/avatar + linked
 * Tezos address) after consent; `serviceAuth` mints a short-lived, audience-
 * bound JWT via the user's own PDS (com.atproto.server.getServiceAuth) after
 * consent. A leaked token is only good against the consented `aud`.
 */
/** Protocol-traffic event for dev tooling (the /interactive console).
 *  dir 'in' = from the artifact, 'out' = from the host. */
export interface BridgeEvent {
  time: number
  dir: 'in' | 'out' | 'info' | 'error'
  label: string
  detail?: unknown
}

// Known Tezos operation kinds the wallet accepts. Kept permissive (generic
// tezosOperation) but each op must be an object with a string kind; transaction
// destinations/amounts are validated shallowly so the consent dialog can render
// them. The wallet does full validation + fee estimation itself.
const TEZOS_OP_KINDS = new Set([
  'transaction',
  'delegation',
  'origination',
  'increase_paid_storage',
  'transfer_ticket',
])

function parseTezosOps(raw: unknown): TezosOp[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null
  const ops: TezosOp[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const kind = (item as { kind?: unknown }).kind
    if (typeof kind !== 'string' || !TEZOS_OP_KINDS.has(kind)) return null
    if (kind === 'transaction') {
      const dest = (item as { destination?: unknown }).destination
      if (typeof dest !== 'string' || !/^(tz[123]|KT1)[0-9A-Za-z]{33}$/.test(dest)) return null
      const amt = (item as { amount?: unknown }).amount
      if (amt !== undefined && typeof amt !== 'string' && typeof amt !== 'number') return null
    }
    ops.push(item as TezosOp)
  }
  return ops
}

export function useInteractiveBridge(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  src: string | undefined,
  title?: string,
  onEvent?: (e: BridgeEvent) => void,
) {
  const { agent, did, isAuthed } = useAgent()
  const queryClient = useQueryClient()
  const ask = useConsentStore((s) => s.ask)
  const requestWalletOp = useWalletOpStore((s) => s.request)

  // Latest auth state, read at message time. Keeping these out of the effect
  // deps means an auth refresh doesn't tear down a live port mid-conversation
  // (the child only re-handshakes when IT reloads).
  const live = useRef({ agent, did, isAuthed, title, onEvent, requestWalletOp })
  live.current = { agent, did, isAuthed, title, onEvent, requestWalletOp }

  useEffect(() => {
    const origin = interactiveFrameOrigin(src)
    if (!origin) return

    let port: MessagePort | null = null
    // Dialog-spam protection, per frame connection (cleared on re-handshake):
    // read kinds get a permanent denial latch; write kinds get a short cooldown
    // instead — a game legitimately re-asks to post after the next level, but a
    // hostile artifact must not be able to loop the dialog. One prompt per kind
    // may be pending at a time; extra requests fail 'busy'.
    const WRITE_KINDS: ReadonlySet<ConsentKind> = new Set(['post', 'like', 'repost', 'follow'])
    const DENY_COOLDOWN_MS = 10_000
    const denied = new Set<string>()
    const cooldownUntil = new Map<string, number>()
    const inFlight = new Set<string>()

    const emit = (dir: BridgeEvent['dir'], label: string, detail?: unknown) =>
      live.current.onEvent?.({ time: Date.now(), dir, label, detail })
    emit('info', `bridge armed for ${origin}`)

    const consent = async (req: ConsentRequest): Promise<'granted' | 'denied' | 'busy'> => {
      const key = `${req.kind}|${req.aud ?? ''}`
      if (inFlight.has(key)) return 'busy'
      const isWrite = WRITE_KINDS.has(req.kind)
      if (isWrite ? Date.now() < (cooldownUntil.get(key) ?? 0) : denied.has(key)) return 'denied'
      inFlight.add(key)
      emit('info', `consent ${req.kind}${req.aud ? ' → ' + req.aud : ''}`)
      try {
        const granted = await ask(req)
        emit('info', `consent ${req.kind}: ${granted ? 'granted' : 'denied'}`)
        if (!granted) {
          if (isWrite) cooldownUntil.set(key, Date.now() + DENY_COOLDOWN_MS)
          else denied.add(key)
        }
        return granted ? 'granted' : 'denied'
      } finally {
        inFlight.delete(key)
      }
    }

    // Console detail for responses: never print a full token — long, and the
    // console has no business re-leaking what was minted for the artifact.
    const redact = (d: unknown) => {
      if (d && typeof d === 'object' && 'token' in d) {
        const t = (d as { token: unknown }).token
        if (typeof t === 'string') return { token: `${t.slice(0, 24)}… (${t.length} chars)` }
      }
      return d
    }

    const handle = async (m: unknown) => {
      const msg = m as { ovoid?: number; id?: unknown; type?: unknown } & Record<string, unknown>
      if (!msg || msg.ovoid !== 1 || typeof msg.id !== 'string' || typeof msg.type !== 'string')
        return
      const id = msg.id
      const fail = (error: string) => {
        emit('error', `${String(msg.type)} → ${error}`)
        port?.postMessage({ ovoid: 1, id, ok: false, error })
      }
      const okay = (data: unknown) => {
        emit('out', `${String(msg.type)} ok`, redact(data))
        port?.postMessage({ ovoid: 1, id, ok: true, data })
      }
      emit('in', String(msg.type), msg)
      const { agent, did, isAuthed, title } = live.current

      try {
        switch (msg.type) {
          case 'viewer': {
            if (!isAuthed || !did) return fail('unauthenticated')
            const c = await consent({ kind: 'viewer', origin, title })
            if (c !== 'granted') return fail(c === 'busy' ? 'busy' : 'denied')
            const [profile, tezosAddress] = await Promise.all([
              queryClient.fetchQuery(profileOptions(agent, did)),
              queryClient.fetchQuery(tezosAddressOptions(did)).catch(() => null),
            ])
            return okay({
              did,
              handle: profile.handle,
              displayName: profile.displayName,
              avatar: profile.avatar,
              tezosAddress,
            })
          }
          case 'serviceAuth': {
            if (!isAuthed || !did) return fail('unauthenticated')
            const { aud, lxm, expSec } = msg
            if (typeof aud !== 'string' || !/^did:(web|plc):[a-zA-Z0-9._%-]+$/.test(aud))
              return fail('bad-request')
            if (lxm !== undefined && (typeof lxm !== 'string' || lxm.length > 256))
              return fail('bad-request')
            const c = await consent({ kind: 'serviceAuth', origin, title, aud })
            if (c !== 'granted') return fail(c === 'busy' ? 'busy' : 'denied')
            const exp =
              typeof expSec === 'number' && expSec > 0
                ? Math.floor(Date.now() / 1000) + Math.min(Math.floor(expSec), 3600)
                : undefined
            const res = await agent.com.atproto.server.getServiceAuth({
              aud,
              ...(lxm !== undefined ? { lxm } : {}),
              ...(exp !== undefined ? { exp } : {}),
            })
            return okay({ token: res.data.token })
          }
          case 'post': {
            if (!isAuthed || !did) return fail('unauthenticated')
            const text = typeof msg.text === 'string' ? msg.text : ''
            const rt = new RichText({ text })
            if (!text.trim() || rt.graphemeLength > 300) return fail('bad-request')
            const c = await consent({ kind: 'post', origin, title, postText: text })
            if (c !== 'granted') return fail(c === 'busy' ? 'busy' : 'denied')
            await rt.detectFacets(agent)
            const res = await agent.post({ text: rt.text, facets: rt.facets })
            return okay({ uri: res.uri, cid: res.cid })
          }
          case 'like':
          case 'repost': {
            if (!isAuthed || !did) return fail('unauthenticated')
            const uri = msg.uri
            if (typeof uri !== 'string' || !/^at:\/\/\S+$/.test(uri) || uri.length > 1024)
              return fail('bad-request')
            // Resolve the target ourselves — the dialog must show what the post
            // actually says, not what the artifact claims it says.
            const res = await agent.app.bsky.feed.getPosts({ uris: [uri] })
            const post = res.data.posts[0]
            if (!post) return fail('not-found')
            const rec = post.record as { text?: string }
            const subject = {
              handle: post.author.handle,
              text: typeof rec.text === 'string' ? rec.text.slice(0, 140) : undefined,
            }
            const kind = msg.type as 'like' | 'repost'
            const c = await consent({ kind, origin, title, subject })
            if (c !== 'granted') return fail(c === 'busy' ? 'busy' : 'denied')
            if (kind === 'like') {
              if (post.viewer?.like) return okay({ uri: post.viewer.like, existing: true })
              const r = await agent.like(uri, post.cid)
              return okay({ uri: r.uri })
            }
            if (post.viewer?.repost) return okay({ uri: post.viewer.repost, existing: true })
            const r = await agent.repost(uri, post.cid)
            return okay({ uri: r.uri })
          }
          case 'follow': {
            if (!isAuthed || !did) return fail('unauthenticated')
            const actor = msg.actor
            if (typeof actor !== 'string' || !actor || actor.length > 253 || /\s/.test(actor))
              return fail('bad-request')
            const profile = await queryClient.fetchQuery(profileOptions(agent, actor))
            if (profile.did === did) return fail('bad-request')
            const c = await consent({
              kind: 'follow',
              origin,
              title,
              subject: { handle: profile.handle, displayName: profile.displayName },
            })
            if (c !== 'granted') return fail(c === 'busy' ? 'busy' : 'denied')
            if (profile.viewer?.following)
              return okay({ did: profile.did, uri: profile.viewer.following, existing: true })
            const r = await agent.follow(profile.did)
            return okay({ did: profile.did, uri: r.uri })
          }
          case 'tezosOperation': {
            if (!isAuthed || !did) return fail('unauthenticated')
            const ops = parseTezosOps(msg.ops)
            if (!ops) return fail('bad-request')
            // The operation may only run against the user's linked wallet — the
            // same tz address we hand apps via `viewer`. No link → nothing to
            // sign against.
            const linked = await queryClient
              .fetchQuery(tezosAddressOptions(did))
              .catch(() => null)
            if (!linked) return fail('no-linked-wallet')
            // Dialog-spam guard (write-class), then hand off to the wallet
            // dialog which owns connect → verify-address → confirm → sign.
            const key = 'tezosOperation'
            if (inFlight.has(key)) return fail('busy')
            if (Date.now() < (cooldownUntil.get(key) ?? 0)) return fail('denied')
            inFlight.add(key)
            emit('info', `tezosOperation: ${ops.length} op(s) → ${linked}`)
            try {
              const opHash = await live.current.requestWalletOp({
                origin,
                title,
                ops,
                linkedAddress: linked,
              })
              return okay({ opHash })
            } catch (e) {
              const reason = e instanceof Error ? e.message : 'failed'
              if (reason === 'denied') cooldownUntil.set(key, Date.now() + DENY_COOLDOWN_MS)
              return fail(reason)
            } finally {
              inFlight.delete(key)
            }
          }
          default:
            return fail('unknown-request')
        }
      } catch (e) {
        fail(e instanceof Error ? e.message : 'failed')
      }
    }

    const onMessage = (e: MessageEvent) => {
      // Frame identity first (other bridge instances handle their own frames
      // silently), THEN origin — a matching frame on the wrong origin means it
      // navigated away, which is worth surfacing in the console.
      const frame = iframeRef.current
      if (!frame?.contentWindow || e.source !== frame.contentWindow) return
      const d = e.data as { ovoid?: number; type?: string } | null
      if (!d || d.ovoid !== 1) return
      if (e.origin !== origin) {
        emit('error', `ignored ovoid message from unexpected origin ${e.origin}`)
        return
      }
      if (d.type !== 'ready') return
      // Fresh handshake on every ready (child reload): drop the old port.
      port?.close()
      denied.clear()
      emit('in', 'ready')
      const hello = {
        ovoid: 1,
        type: 'hello',
        api: ['viewer', 'serviceAuth', 'post', 'like', 'repost', 'follow', 'tezosOperation'],
        authed: live.current.isAuthed,
      }
      emit('out', 'hello', { api: hello.api, authed: hello.authed })
      const ch = new MessageChannel()
      port = ch.port1
      port.onmessage = (ev) => void handle(ev.data)
      frame.contentWindow.postMessage(hello, origin, [ch.port2])
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      port?.close()
      port = null
    }
  }, [iframeRef, src, ask, queryClient])
}
