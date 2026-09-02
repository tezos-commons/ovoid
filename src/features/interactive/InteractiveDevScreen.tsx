import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { usePageFullWidth } from '@/components/layout/PageLayout'
import { useIsMobile } from '@/lib/use-is-mobile'
import { ipfsSubdomainUrl } from '@/lib/ipfs'
import { useInteractiveBridge, type BridgeEvent } from './bridge'
import './interactive.css'

const PORT_RE = /^\d{2,5}$/

/**
 * Interactive-artifact dev harness.
 *
 * /interactive/<cid>       — load a CID in the ArtifactPlayer sandbox with the
 *                            bridge attached.
 * /interactive/dev         — source picker: an IPFS CID, or (dev builds only)
 *                            a localhost port, kept in ?port= so refresh works.
 *
 * A collapsible console at the bottom shows the bridge's protocol traffic
 * (handshake, requests, responses, consent decisions) via the hook's onEvent.
 */
export default function InteractiveDevScreen() {
  const { cid = '' } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const port = new URLSearchParams(search).get('port')

  const src =
    cid === 'dev'
      ? import.meta.env.DEV && port && PORT_RE.test(port)
        ? `http://localhost:${port}/`
        : undefined
      : ipfsSubdomainUrl(`ipfs://${cid}${search}`)

  const frameRef = useRef<HTMLIFrameElement>(null)
  const [events, setEvents] = useState<BridgeEvent[]>([])
  const onEvent = useCallback(
    (e: BridgeEvent) => setEvents((prev) => [...prev.slice(-199), e]),
    [],
  )
  useInteractiveBridge(frameRef, src, src ? `dev: ${new URL(src).host}` : undefined, onEvent)
  const isMobile = useIsMobile()
  usePageFullWidth(!isMobile)

  return (
    <div className="itest">
      <div className="itest__bar">
        {src ? (
          <>
            <code className="itest__src">{src}</code>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setEvents([])
                navigate('/interactive/dev')
              }}
            >
              Change source
            </button>
          </>
        ) : (
          <span className="itest__meta">Load an interactive artifact to exercise the bridge.</span>
        )}
      </div>

      {src ? (
        <iframe
          ref={frameRef}
          className="itest__frame"
          src={src}
          title="Interactive artifact dev frame"
          sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
          allow="autoplay; fullscreen; xr-spatial-tracking; gamepad"
          referrerPolicy="no-referrer"
        />
      ) : (
        <SourcePicker cid={cid} onOpen={(to) => navigate(to)} />
      )}

      <DevConsole events={events} onClear={() => setEvents([])} />
    </div>
  )
}

function SourcePicker({ cid, onOpen }: { cid: string; onOpen: (to: string) => void }) {
  const [port, setPort] = useState('5580')
  const [cidInput, setCidInput] = useState('')

  const openPort = (e: FormEvent) => {
    e.preventDefault()
    if (PORT_RE.test(port)) onOpen(`/interactive/dev?port=${port}`)
  }
  const openCid = (e: FormEvent) => {
    e.preventDefault()
    const c = cidInput.trim()
    if (c) onOpen(`/interactive/${c}`)
  }

  return (
    <div className="itest__picker">
      {cid !== 'dev' && (
        <p className="itest__meta">
          “{cid}” is not a loadable CID — the bridge needs CIDv0 (Qm…) or CIDv1 base32 (b…).
        </p>
      )}
      {import.meta.env.DEV ? (
        <form className="itest__picker-row" onSubmit={openPort}>
          <label htmlFor="itest-port">Local port</label>
          <input
            id="itest-port"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            inputMode="numeric"
            placeholder="5580"
          />
          <button className="btn btn--primary btn--sm">Open</button>
        </form>
      ) : (
        <p className="itest__meta">Localhost sources are available in dev builds only.</p>
      )}
      <form className="itest__picker-row" onSubmit={openCid}>
        <label htmlFor="itest-cid">IPFS CID</label>
        <input
          id="itest-cid"
          value={cidInput}
          onChange={(e) => setCidInput(e.target.value)}
          placeholder="bafy… or Qm…"
          spellCheck={false}
        />
        <button className="btn btn--primary btn--sm">Open</button>
      </form>
    </div>
  )
}

const DIR_GLYPH: Record<BridgeEvent['dir'], string> = {
  in: '→',
  out: '←',
  info: '·',
  error: '✕',
}

function fmtDetail(d: unknown): string {
  const s = JSON.stringify(d)
  if (!s) return ''
  return s.length > 400 ? s.slice(0, 400) + '…' : s
}

function DevConsole({ events, onClear }: { events: BridgeEvent[]; onClear: () => void }) {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight)
  }, [events, open])

  return (
    <div className={clsx('itest__console', open && 'itest__console--open')}>
      <button type="button" className="itest__console-head" onClick={() => setOpen((o) => !o)}>
        <span>
          {open ? '▾' : '▸'} Bridge console
        </span>
        <span className="itest__console-count">{events.length}</span>
        {open && (
          <span
            className="itest__console-clear"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onClear()
              }
            }}
          >
            clear
          </span>
        )}
      </button>
      {open && (
        <div className="itest__console-body" ref={bodyRef}>
          {events.length === 0 && <div className="itest__line itest__line--info">no bridge traffic yet</div>}
          {events.map((ev, i) => (
            <div key={i} className={`itest__line itest__line--${ev.dir}`}>
              <span className="itest__line-time">{new Date(ev.time).toLocaleTimeString()}</span>
              <span className="itest__line-dir">{DIR_GLYPH[ev.dir]}</span>
              <span>{ev.label}</span>
              {ev.detail !== undefined && (
                <span className="itest__line-detail">{fmtDetail(ev.detail)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
