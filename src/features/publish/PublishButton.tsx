import { useNavigate } from 'react-router-dom'
import { Button, Menu } from '@/components'
import { usePublications } from './use-publications'

function QuillIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20c6-2 8-6 12-12 1.5-2.2 3-4 3-4s-1 6-4 10c-2.5 3.3-6 5-11 6Z" />
      <path d="M4 20l5-5" />
    </svg>
  )
}

/**
 * Top-bar "Publish" button — opens a publication's studio. Only renders when the
 * viewer owns at least one publication; with more than one it opens a picker.
 * Desktop only (the top bar itself is hidden on mobile).
 */
export function PublishButton() {
  const navigate = useNavigate()
  const { data } = usePublications()
  const pubs = data ?? []
  if (pubs.length === 0) return null

  const go = (subdomain: string) => navigate(`/studio/${subdomain}`)

  if (pubs.length === 1) {
    return (
      <Button variant="secondary" icon={<QuillIcon />} onClick={() => go(pubs[0].subdomain)}>
        Publish
      </Button>
    )
  }

  return (
    <Menu
      trigger={
        <Button variant="secondary" icon={<QuillIcon />}>
          Publish
        </Button>
      }
      items={pubs.map((p) => ({
        key: p.subdomain,
        label: `${p.subdomain}.ovoid.at`,
        onSelect: () => go(p.subdomain),
      }))}
    />
  )
}
